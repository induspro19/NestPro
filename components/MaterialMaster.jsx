import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ICONS, NAV, T, Icon, Btn, Card, Badge, Input, Select, Field, SectionHeader, EmptyState, Modal, StatCard, UtilArc } from './ui.jsx';
import { uid, fmt, fmtCurrency, parseCsvParts, blankDraft, SEED_MATERIALS, SEED_STANDARD_PARTS } from '../utils/helper.js';
import { downloadDxf, parseDxfDimensions } from '../utils/dxfExport.js';
import { runOptimization, runGeneticOptimizationAsync, packSecondaryParts, collectScrapCandidates, aiQualityScore, aiAutoSelectAlgorithm, breakdownBySize } from '../utils/nestingAlgorithm.js';
import { storeGet, storeSet, storeDelete, cloudSave, cloudLoad } from '../services/storage.js';

export function MaterialModal({
  material,
  onClose,
  onSave
}) {
  const [m, setM] = useState(material);
  const set = (k, v) => setM(p => ({
    ...p,
    [k]: v
  }));
  const addSize = () => setM(p => ({
    ...p,
    sheetSizes: [...p.sheetSizes, {
      id: uid('sz'),
      l: 2500,
      w: 1250
    }]
  }));
  const updSize = (id, k, v) => setM(p => ({
    ...p,
    sheetSizes: p.sheetSizes.map(s => s.id === id ? {
      ...s,
      [k]: parseFloat(v) || 0
    } : s)
  }));
  const rmSize = id => setM(p => ({
    ...p,
    sheetSizes: p.sheetSizes.filter(s => s.id !== id)
  }));
  return <Modal title={material.name ? 'Edit Material' : 'Add Material'} onClose={onClose}>
      
          <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }}>

        <Field label="Material Name"><Input value={m.name} onChange={e => set('name', e.target.value)} placeholder="Stainless Steel" /></Field>
        <Field label="Grade / Finish"><Input value={m.grade} onChange={e => set('grade', e.target.value)} placeholder="SS304 2B" /></Field>
        <Field label="Thickness (mm)"><Input type="number" value={m.thickness} onChange={e => set('thickness', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Density (kg/m³)"><Input type="number" value={m.density} onChange={e => set('density', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Cost per Kg (₹)"><Input type="number" value={m.costPerKg} onChange={e => set('costPerKg', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Cost per Sqm (₹)"><Input type="number" value={m.costPerSqm} onChange={e => set('costPerSqm', parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Supplier"><Input value={m.supplier} onChange={e => set('supplier', e.target.value)} /></Field>
        <Field label="Stock (kg)"><Input type="number" value={m.stock} onChange={e => set('stock', parseFloat(e.target.value) || 0)} /></Field>
      </div>
      <div style={{
      marginTop: 16
    }}>
        <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
      }}>
          <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.textMuted,
          textTransform: 'uppercase'
        }}>Sheet Sizes (mm)</span>
          <Btn size="sm" variant="ghost" icon="plus" onClick={addSize}>Add</Btn>
        </div>
        {m.sheetSizes.map(s => <div key={s.id} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
      }}>
            <Input type="number" value={s.l} onChange={e => updSize(s.id, 'l', e.target.value)} style={{
          width: 100
        }} />
            <span style={{
          color: T.textMuted
        }}>×</span>
            <Input type="number" value={s.w} onChange={e => updSize(s.id, 'w', e.target.value)} style={{
          width: 100
        }} />
            <button onClick={() => rmSize(s.id)} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: T.red
        }}><Icon d={ICONS.trash} size={14} /></button>
          </div>)}
      </div>
      <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 20
    }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon="save" onClick={() => onSave(m)} disabled={!m.name}>Save Material</Btn>
      </div>
    </Modal>;
}

/* ════════════════════════════════════════
   NEW JOB
════════════════════════════════════════ */
export default function MaterialsPanel({
  materials,
  setMaterials,
  persist
}) {
  const [editing, setEditing] = useState(null);
  const blank = () => ({
    id: uid('mat'),
    name: '',
    grade: '',
    thickness: 3,
    density: 7850,
    costPerKg: 0,
    costPerSqm: 0,
    supplier: '',
    stock: 0,
    sheetSizes: []
  });
  const save = mat => {
    const exists = materials.some(m => m.id === mat.id);
    const next = exists ? materials.map(m => m.id === mat.id ? mat : m) : [...materials, mat];
    setMaterials(next);
    persist('materials', next);
    setEditing(null);
  };
  const remove = id => {
    const next = materials.filter(m => m.id !== id);
    setMaterials(next);
    persist('materials', next);
  };
  return <div className="slide-up">
      <SectionHeader eyebrow="Master Data" title="Material Master" action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Material</Btn>} />
      {materials.length === 0 ? <Card><EmptyState title="No materials" body="Add a material to start building nesting jobs." action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Material</Btn>} /></Card> : <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
      gap: 12
    }}>
          {materials.map(m => <Card key={m.id}>
              <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
                <div>
                  <div style={{
              fontFamily: T.fontDisplay,
              fontSize: 18,
              fontWeight: 700,
              color: T.text
            }}>{m.name} <span style={{
                fontSize: 13,
                fontWeight: 400,
                color: T.textMuted
              }}>· {m.grade}</span></div>
                  <div style={{
              fontSize: 12,
              color: T.textMuted,
              marginTop: 2
            }}>{m.thickness}mm · {m.supplier || 'no supplier'}</div>
                </div>
                <div style={{
            display: 'flex',
            gap: 4
          }}>
                  <button onClick={() => setEditing(m)} style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.blue
            }}><Icon d={ICONS.gear} size={15} /></button>
                  <button onClick={() => remove(m.id)} style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.red
            }}><Icon d={ICONS.trash} size={15} /></button>
                </div>
              </div>
              <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
          fontSize: 12,
          fontFamily: T.fontMono,
          color: T.textDim
        }}>
                <span>₹/sqm: <b style={{
              color: T.text
            }}>{m.costPerSqm || '—'}</b></span>
                <span>₹/kg: <b style={{
              color: T.text
            }}>{m.costPerKg || '—'}</b></span>
              </div>
              <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 10
        }}>
                {(m.sheetSizes || []).map(s => <Badge key={s.id} color={T.blue}>{s.l} × {s.w}</Badge>)}
                {!m.sheetSizes?.length && <span style={{
            fontSize: 12,
            color: T.textMuted
          }}>No sheet sizes</span>}
              </div>
            </Card>)}
        </div>}
      {editing && <MaterialModal material={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>;
}