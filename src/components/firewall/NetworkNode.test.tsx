// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NetworkNodeComponent } from './NetworkNode';
import { NetworkNode } from '@/types/firewall';
import { validateNodeName } from '@/lib/nodeNames';

const nodes: NetworkNode[] = [
  { id: 'router', type: 'router', name: 'Router', x: 0, y: 0, parentId: null },
  { id: 'v1', type: 'vlan', name: 'DATA', x: 100, y: 100, parentId: 'router' },
  { id: 'v2', type: 'vlan', name: 'SEC', x: 300, y: 100, parentId: 'router' }
];

function renderNode(onUpdate = vi.fn()) {
  render(
    <NetworkNodeComponent
      node={nodes[1]}
      isSelected
      isEditable
      onSelect={() => {}}
      onUpdate={onUpdate}
      onDelete={() => {}}
      onDragStart={() => {}}
      validateName={(name) => validateNodeName(nodes, 'v1', name)}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'DATA hernoemen' }));
  return onUpdate;
}

describe('NetworkNode rename', () => {
  it('blocks a name that another node already uses and says why', () => {
    const onUpdate = renderNode();
    const input = screen.getByLabelText('Nieuwe naam');

    fireEvent.change(input, { target: { value: 'sec' } });

    expect(screen.getByRole('alert')).toHaveTextContent('De naam "sec" is al in gebruik.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Naam opslaan' })).toBeDisabled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('saves a valid new name', () => {
    const onUpdate = renderNode();
    fireEvent.change(screen.getByLabelText('Nieuwe naam'), { target: { value: 'Kantoor' } });
    fireEvent.keyDown(screen.getByLabelText('Nieuwe naam'), { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith({ name: 'Kantoor' });
  });
});
