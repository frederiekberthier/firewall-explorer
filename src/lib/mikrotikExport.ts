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

/**
 * Name for a RouterOS address-list: only [a-z0-9_-], so names with quotes,
 * slashes, `$` etc. can never break the generated command.
 */
export const sanitizeListName = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'lijst';

/**
 * Escape text for use inside a RouterOS double-quoted string (comment="…"):
 * backslash, double quote and `$` (which RouterOS reads as a variable).
 */
export const escapeRouterOsString = (text: string) => text.replace(/[\\"$]/g, ch => `\\${ch}`);

/** RouterOS interface list for the Internet side (MikroTik default config). */
const WAN_LIST = 'WAN';

/**
 * Builds a RouterOS configuration that behaves like the simulator: the
 * explicit rules in order, followed by the two safety nets the simulator
 * applies when no rule matches (RouterOS itself accepts whatever falls off
 * the end of a chain, so without them the export would act as allow-all).
 *
 * How rule endpoints are exported, mirroring matchesWildcard() in
 * firewallEngine.ts:
 * - ANY          -> no restriction (e.g. the classic global
 *                   "accept established,related" rule)
 * - ANY_VLAN     -> address-list with every VLAN subnet
 * - ANY_HOST     -> address-list with every host IP
 * - Internet / ANY_INTERNET -> the WAN interface list (in-/out-interface-list),
 *                   not 0.0.0.0/0: that range also contains every internal
 *                   subnet, so "DATA -> Internet" would allow DATA -> SEC too
 * - VLAN, host, address list -> an address-list of its own
 */
export function buildMikrotikConfig({
  nodes,
  rules,
  addressLists,
  firewallPolicy,
  generatedAt = new Date()
}: MikrotikExportInput): string {
  const nameOf = (id: string) => getNodeName(nodes, id, addressLists);
  const isInternet = (id: string) => id === 'ANY_INTERNET' || nodes.find(n => n.id === id)?.type === 'internet';

  const sortedRules = [...rules].sort((a, b) => a.order - b.order);

  // Distinct RouterOS list names, handed out in order of first use; a clash
  // (two nodes named alike, a node and a list both called "data", …) gets a
  // numeric suffix instead of silently merging into one RouterOS list.
  const usedListNames = new Set<string>();
  const listNameById = new Map<string, string>();
  const listNameFor = (id: string, displayName: string) => {
    const existing = listNameById.get(id);
    if (existing) return existing;
    const base = sanitizeListName(displayName);
    let name = base;
    for (let i = 2; usedListNames.has(name); i++) name = `${base}_${i}`;
    usedListNames.add(name);
    listNameById.set(id, name);
    return name;
  };

  const vlans = nodes.filter(n => n.type === 'vlan');
  const hosts = nodes.filter(n => n.type === 'host');
  const vlanLine = (node: NetworkNode, listName: string, label = node.name) =>
    `/ip firewall address-list add list=${listName} address=${node.subnet || '192.168.x.0/24'} comment="${escapeRouterOsString(`${label} (VLAN ${node.vlanId ?? '?'})`)}"`;
  const hostLine = (node: NetworkNode, listName: string, label = node.name) =>
    `/ip firewall address-list add list=${listName} address=${node.ip || '192.168.x.x'} comment="${escapeRouterOsString(label)}"`;
  const memberLine = (node: NetworkNode, listName: string) =>
    node.type === 'vlan' ? vlanLine(node, listName) : node.type === 'host' ? hostLine(node, listName) : '';

  // Address-list definitions for Step 1, keyed by list name, in first-use order.
  const addressListBlocks: string[] = [];
  const defineList = (id: string): string | null => {
    if (listNameById.has(id)) return listNameById.get(id)!;

    if (id === 'ANY_VLAN') {
      const name = listNameFor(id, 'any_vlan');
      addressListBlocks.push(
        vlans.length > 0
          ? `# Address list for ANY VLAN (alle VLAN-subnetten)\n${vlans.map(v => vlanLine(v, name, `ANY VLAN: ${v.name}`)).join('\n')}`
          : `# Address list for ANY VLAN: dit netwerk heeft geen VLAN's, de lijst blijft leeg`
      );
      return name;
    }
    if (id === 'ANY_HOST') {
      const name = listNameFor(id, 'any_host');
      addressListBlocks.push(
        hosts.length > 0
          ? `# Address list for ANY HOST (alle hosts)\n${hosts.map(h => hostLine(h, name, `ANY HOST: ${h.name}`)).join('\n')}`
          : `# Address list for ANY HOST: dit netwerk heeft geen hosts, de lijst blijft leeg`
      );
      return name;
    }

    const list = addressLists.find(l => l.id === id);
    if (list) {
      const name = listNameFor(id, list.name);
      const memberLines = list.memberIds
        .map(memberId => nodes.find(n => n.id === memberId))
        .filter((n): n is NetworkNode => !!n)
        .map(member => memberLine(member, name))
        .join('\n');
      addressListBlocks.push(`# Address list "${list.name}" (${list.memberIds.length} leden)\n${memberLines}`);
      return name;
    }

    const node = nodes.find(n => n.id === id);
    if (!node || (node.type !== 'vlan' && node.type !== 'host')) return null;
    const name = listNameFor(id, node.name);
    addressListBlocks.push(`# Address list for ${node.name}\n${memberLine(node, name)}`);
    return name;
  };

  const endpointParam = (id: string, side: 'src' | 'dst') => {
    if (id === 'ANY') return '';
    if (isInternet(id)) return `${side === 'src' ? 'in' : 'out'}-interface-list=${WAN_LIST}`;
    const listName = defineList(id);
    return listName ? `${side}-address-list=${listName}` : '';
  };

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
      const srcParam = endpointParam(rule.sourceId, 'src');
      // chain=input already means "traffic to the router" — no destination
      // restriction is needed (or meaningful) there.
      const dstParam = chain === 'input' ? '' : endpointParam(rule.destinationId, 'dst');
      const connectionState = rule.connectionStates.join(',');
      const action = rule.action === 'allow' ? 'accept' : rule.action === 'reject' ? 'reject' : 'drop';

      const comment = `Rule ${index + 1}: ${source} -> ${destination} (${connectionState})`;

      const params = [
        `chain=${chain}`,
        srcParam,
        dstParam,
        `connection-state=${connectionState}`,
        `action=${action}`,
        `comment="${escapeRouterOsString(comment)}"`
      ].filter(Boolean).join(' ');

      return `/ip firewall filter add ${params}`;
    })
    .join('\n');

  const addressListConfig = addressListBlocks.length > 0
    ? addressListBlocks.join('\n\n')
    : '# Geen address-lists nodig voor deze regels';

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
# Internet wordt niet als adresbereik geexporteerd maar als de interface-lijst
# "${WAN_LIST}" (in-interface-list / out-interface-list), zoals in de MikroTik-
# standaardconfiguratie. Controleer dat je WAN-poort in die lijst zit.
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
