import { NetworkNode, FirewallRule, FirewallPolicy, AddressList } from '@/types/firewall';
import { getNodeName } from '@/lib/nodeNames';

export interface MikrotikExportInput {
  nodes: NetworkNode[];
  rules: FirewallRule[];
  addressLists: AddressList[];
  firewallPolicy: FirewallPolicy;
  /** Timestamp for the header; injectable so tests get a stable output. */
  generatedAt?: Date;
}

const isWildcardId = (id: string) => id.startsWith('ANY');

const listNameFor = (name: string) => name.toLowerCase().replace(/\s+/g, '_');

/**
 * Builds a RouterOS configuration that behaves like the simulator: the
 * explicit rules in order, followed by the two safety nets the simulator
 * applies when no rule matches (RouterOS itself accepts whatever falls off
 * the end of a chain, so without them the export would act as allow-all).
 */
export function buildMikrotikConfig({
  nodes,
  rules,
  addressLists,
  firewallPolicy,
  generatedAt = new Date()
}: MikrotikExportInput): string {
  const nameOf = (id: string) => getNodeName(nodes, id, addressLists);

  const addressParam = (nodeId: string, paramType: 'src' | 'dst') => {
    const prefix = paramType === 'src' ? 'src-address-list' : 'dst-address-list';

    // Wildcards carry no address restriction
    if (isWildcardId(nodeId)) return '';

    const list = addressLists.find(l => l.id === nodeId);
    if (list) return `${prefix}=${listNameFor(list.name)}`;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return '';
    return `${prefix}=${listNameFor(node.name)}`;
  };

  // Collect distinct address-list definitions needed: either a manually
  // created list (one line per member, sharing that list's name), or a
  // single node referenced directly by a rule (one line, list name
  // derived from the node's own name, as before address lists existed).
  const referencedListIds = new Set<string>();
  const referencedNodeIds = new Set<string>();
  rules.forEach(rule => {
    [rule.sourceId, rule.destinationId].forEach(id => {
      if (isWildcardId(id)) return;
      if (addressLists.some(l => l.id === id)) {
        referencedListIds.add(id);
        return;
      }
      // The router itself needs no address-list entry: a rule aimed at it
      // exports as chain=input, which already means "traffic to the
      // router" without a dst-address-list (see dstParam below).
      const node = nodes.find(n => n.id === id);
      if (node?.type === 'router') return;
      referencedNodeIds.add(id);
    });
  });

  const nodeAddressLine = (node: NetworkNode, listName: string) => {
    if (node.type === 'internet') {
      return `/ip firewall address-list add list=${listName} address=0.0.0.0/0 comment="${node.name} - adjust to actual external networks"`;
    } else if (node.type === 'vlan') {
      const address = node.subnet || '192.168.x.0/24';
      return `/ip firewall address-list add list=${listName} address=${address} comment="${node.name} (VLAN ${node.vlanId ?? '?'})"`;
    } else if (node.type === 'host') {
      const address = node.ip || '192.168.x.x';
      return `/ip firewall address-list add list=${listName} address=${address} comment="${node.name}"`;
    }
    return '';
  };

  const addressListConfig = [
    ...Array.from(referencedNodeIds).map(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return '';
      return `# Address list for ${node.name}\n${nodeAddressLine(node, listNameFor(node.name))}`;
    }),
    ...Array.from(referencedListIds).map(listId => {
      const list = addressLists.find(l => l.id === listId);
      if (!list) return '';
      const listName = listNameFor(list.name);
      const memberLines = list.memberIds
        .map(memberId => nodes.find(n => n.id === memberId))
        .filter((n): n is NetworkNode => !!n)
        .map(member => nodeAddressLine(member, listName))
        .join('\n');
      return `# Address list "${list.name}" (${list.memberIds.length} leden)\n${memberLines}`;
    })
  ]
    .filter(Boolean)
    .join('\n\n');

  const sortedRules = [...rules].sort((a, b) => a.order - b.order);

  const filterConfig = sortedRules
    .map((rule, index) => {
      const source = nameOf(rule.sourceId);
      const destination = nameOf(rule.destinationId);
      const destNode = nodes.find(n => n.id === rule.destinationId);
      // A rule aimed at the router itself is management traffic (chain
      // input), everything else is regular inter-VLAN/host traffic
      // (chain forward) — this is the vast majority of rules, and the
      // only chain anyone needs to think about unless they deliberately
      // pick the router as a destination.
      const chain = destNode?.type === 'router' ? 'input' : 'forward';
      const srcParam = addressParam(rule.sourceId, 'src');
      // chain=input already means "traffic to the router" — no separate
      // dst-address-list is needed (or meaningful) there.
      const dstParam = chain === 'input' ? '' : addressParam(rule.destinationId, 'dst');
      const connectionState = rule.connectionStates.join(',');
      const action = rule.action === 'allow' ? 'accept' : rule.action === 'reject' ? 'reject' : 'drop';

      const comment = `Rule ${index + 1}: ${source} -> ${destination} (${connectionState})`;

      const params = [
        `chain=${chain}`,
        srcParam,
        dstParam,
        `connection-state=${connectionState}`,
        `action=${action}`,
        `comment="${comment}"`
      ].filter(Boolean).join(' ');

      return `/ip firewall filter add ${params}`;
    })
    .join('\n');

  // What the simulator does when no rule matches (see checkRules in
  // firewallEngine.ts). These must come after the explicit rules, so an
  // explicit allow still wins — exactly as in the simulator.
  const safetyNet = [
    '# Vangnet 1: security-regel van de simulator (altijd actief).',
    '# Nieuw verkeer van Internet naar interne netwerken wordt geblokkeerd, tenzij',
    '# een regel hierboven het expliciet toelaat. "WAN" is de interface-lijst uit de',
    '# MikroTik-standaardconfiguratie; pas aan als je labo een andere naam gebruikt.',
    '/ip firewall filter add chain=forward in-interface-list=WAN connection-state=new action=drop comment="Simulator: nieuw verkeer van Internet naar LAN geblokkeerd"',
    '',
    ...(firewallPolicy === 'block-all'
      ? [
          '# Vangnet 2: default policy Block All.',
          '# Alles wat door geen enkele regel hierboven wordt toegelaten, wordt gedropt,',
          '# ook antwoordverkeer zonder established/related-regel.',
          '/ip firewall filter add chain=forward action=drop comment="Simulator: default policy Block All"',
          '',
          '# In de simulator geldt Block All ook voor verkeer naar de router zelf',
          '# (chain=input). Die regel staat hieronder bewust UITGESCHAKELD:',
          '# !!! LET OP: zonder eigen accept-regels voor beheer (Winbox/SSH/WebFig) en',
          '# !!! voor established/related sluit je jezelf buiten de router.',
          '# Verwijder het # pas als je input-regels hierboven dat afdekken.',
          '# /ip firewall filter add chain=input action=drop comment="Simulator: default policy Block All (input)"'
        ]
      : [
          '# Default policy Allow All: geen extra regel nodig. RouterOS laat verkeer',
          '# dat door geen enkele regel wordt geblokkeerd standaard door.'
        ])
  ].join('\n');

  return `# MikroTik RouterOS Firewall Configuration
# Generated on ${generatedAt.toLocaleString('nl-NL')}
# Total rules: ${rules.length} (+ vangnetten van de simulator)
# Default policy: ${firewallPolicy === 'block-all' ? 'Block All' : 'Allow All'}
#
# INSTRUCTIONS:
# 1. First, apply the address lists below (auto-generated from this network's
#    VLAN subnets / host IPs — check they match your actual lab addressing)
# 2. Then apply the firewall filter rules, followed by the safety nets
#
# Let op: "add" voegt regels achteraan toe. Staan er al filterregels op de
# router (bv. uit de standaardconfiguratie), dan worden die eerst geëvalueerd.
#
# Step 1: Define Address Lists
# =============================

${addressListConfig}

# Step 2: Apply Firewall Filter Rules
# ====================================

${filterConfig}

# Step 3: Safety nets (wat de simulator doet als geen regel matcht)
# ==================================================================

${safetyNet}

# End of configuration
`;
}
