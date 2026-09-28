import { describe, expect, it } from 'vitest';
import { parseAuto, parseNexus, parseNewick, parsePhyloXML } from '../src';

describe('additional parsers', () => {
  it('parses a NEXUS TREES block with TRANSLATE', () => {
    const result = parseNexus(`
#NEXUS
Begin trees;
  Translate
    1 'Homo sapiens',
    2 Pan_troglodytes,
    3 Gorilla_gorilla
  ;
  Tree tree1 = ((1:0.1,2:0.2)AB:0.3,3:0.4)ROOT;
End;
`);

    expect(result.tree.metadata.format).toBe('nexus');
    expect(result.tree.metadata.leafCount).toBe(3);
    expect(result.tree.root.children[0]?.children[0]?.name).toBe('Homo sapiens');
    expect(result.tree.root.children[0]?.children[1]?.name).toBe('Pan_troglodytes');
  });

  it('warns when a NEXUS input contains multiple trees', () => {
    const result = parseNexus(`
#NEXUS
Begin trees;
  Tree one = (A:1,B:2)R1;
  Tree two = (C:1,D:2)R2;
End;
`);

    expect(result.warnings[0]).toContain('Multiple trees detected');
    expect(result.tree.root.name).toBe('R1');
  });

  it('parses a basic PhyloXML phylogeny', () => {
    const result = parsePhyloXML(`
<?xml version="1.0" encoding="UTF-8"?>
<phyloxml xmlns="http://www.phyloxml.org">
  <phylogeny rooted="true">
    <name>Example</name>
    <clade>
      <name>ROOT</name>
      <clade>
        <name>A</name>
        <branch_length>0.1</branch_length>
      </clade>
      <clade>
        <name>B</name>
        <branch_length>0.2</branch_length>
        <confidence>95</confidence>
      </clade>
    </clade>
  </phylogeny>
</phyloxml>
`);

    expect(result.tree.metadata.format).toBe('phyloxml');
    expect(result.tree.metadata.name).toBe('Example');
    expect(result.tree.root.name).toBe('ROOT');
    expect(result.tree.root.children[1]?.confidence).toBe(95);
    expect(result.tree.root.children[0]?.branchLength).toBe(0.1);
  });

  it('detects NEXUS and PhyloXML in parseAuto', () => {
    const nexus = parseAuto('#NEXUS\nBegin trees;\nTree t = (A:1,B:2)ROOT;\nEnd;');
    const phyloXml = parseAuto('<phyloxml><phylogeny><clade><name>ROOT</name></clade></phylogeny></phyloxml>');
    const newick = parseAuto('(A:1,B:2)ROOT;');

    expect(nexus.tree.metadata.format).toBe('nexus');
    expect(phyloXml.tree.metadata.format).toBe('phyloxml');
    expect(newick.tree.metadata.format).toBe('newick');
  });

  it('keeps newick parser behavior unchanged', () => {
    const result = parseNewick('((A:1,B:2)AB:3,C:4)ROOT;');
    expect(result.tree.metadata.format).toBe('newick');
    expect(result.tree.metadata.totalNodes).toBe(5);
  });
});
