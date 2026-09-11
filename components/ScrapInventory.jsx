import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ICONS, NAV, T, Icon, Btn, Card, Badge, Input, Select, Field, SectionHeader, EmptyState, Modal, StatCard, UtilArc } from './ui.jsx';
import { uid, fmt, fmtCurrency, parseCsvParts, blankDraft, SEED_MATERIALS, SEED_STANDARD_PARTS } from '../utils/helper.js';
import { downloadDxf, parseDxfDimensions } from '../utils/dxfExport.js';
import { runOptimization, runGeneticOptimizationAsync, packSecondaryParts, collectScrapCandidates, aiQualityScore, aiAutoSelectAlgorithm, breakdownBySize } from '../utils/nestingAlgorithm.js';
import { storeGet, storeSet, storeDelete, cloudSave, cloudLoad } from '../services/storage.js';

export default function ScrapPanel({
  scrapInventory,
  setScrapInventory,
  persist
}) {
  const [form, setForm] = useState({
    length: '',
    width: '',
    material: '',
    thickness: ''
  });
  const addManual = () => {
    if (!form.length || !form.width) return;
    const item = {
      id: uid('scrap'),
      length: parseFloat(form.length),
      width: parseFloat(form.width),
      material: form.material || 'Unspecified',
      thickness: parseFloat(form.thickness) || 0,
      status: 'Available',
      createdAt: Date.now(),
      location: 'Rack A'
    };
    const next = [item, ...scrapInventory];
    setScrapInventory(next);
    persist('scrap-inventory', next);
    setForm({
      length: '',
      width: '',
      material: '',
      thickness: ''
    });
  };
  const setStatus = (id, status) => {
    const next = scrapInventory.map(s => s.id === id ? {
      ...s,
      status
    } : s);
    setScrapInventory(next);
    persist('scrap-inventory', next);
  };
  const remove = id => {
    const next = scrapInventory.filter(s => s.id !== id);
    setScrapInventory(next);
    persist('scrap-inventory', next);
  };
  const available = scrapInventory.filter(s => s.status === 'Available');
  const consumed = scrapInventory.filter(s => s.status !== 'Available');
  return <div className="slide-up">
      <SectionHeader eyebrow="Reuse Before You Buy" title="Scrap Inventory" />
      <Card style={{
      marginBottom: 12
    }}>
        <div style={{
        fontFamily: T.fontDisplay,
        fontSize: 14,
        fontWeight: 700,
        color: T.text,
        marginBottom: 10
      }}>Add Scrap Manually</div>
        <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'flex-end'
      }}>
          <Field label="Length (mm)"><Input type="number" value={form.length} onChange={e => setForm(f => ({
            ...f,
            length: e.target.value
          }))} style={{
            width: 110
          }} /></Field>
          <Field label="Width (mm)"><Input type="number" value={form.width} onChange={e => setForm(f => ({
            ...f,
            width: e.target.value
          }))} style={{
            width: 110
          }} /></Field>
          <Field label="Material"><Input value={form.material} onChange={e => setForm(f => ({
            ...f,
            material: e.target.value
          }))} style={{
            width: 150
          }} /></Field>
          <Field label="Thickness (mm)"><Input type="number" value={form.thickness} onChange={e => setForm(f => ({
            ...f,
            thickness: e.target.value
          }))} style={{
            width: 110
          }} /></Field>
          <Btn icon="plus" onClick={addManual}>Add</Btn>
        </div>
      </Card>
      <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }}>
        <div>
          <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.green,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8
        }}>Available ({available.length})</div>
          {available.map(s => <Card key={s.id} style={{
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
              <div style={{
            flex: 1,
            fontFamily: T.fontMono,
            fontSize: 13,
            color: T.text
          }}>{s.length} × {s.width} <span style={{
              fontSize: 11,
              color: T.textMuted
            }}>· {s.material}{s.thickness ? ` · ${s.thickness}mm` : ''}</span></div>
              <Btn size="sm" variant="ghost" onClick={() => setStatus(s.id, 'Reserved')}>Reserve</Btn>
              <button onClick={() => remove(s.id)} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: T.red
          }}><Icon d={ICONS.trash} size={14} /></button>
            </Card>)}
          {!available.length && <div style={{
          fontSize: 13,
          color: T.textMuted,
          padding: '1rem 0'
        }}>No scrap available.</div>}
        </div>
        <div>
          <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8
        }}>Reserved / Used ({consumed.length})</div>
          {consumed.map(s => <Card key={s.id} style={{
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: 0.65
        }}>
              <div style={{
            flex: 1,
            fontFamily: T.fontMono,
            fontSize: 13,
            color: T.text
          }}>{s.length} × {s.width} <span style={{
              fontSize: 11,
              color: T.textMuted
            }}>· {s.status}</span></div>
              <Btn size="sm" variant="ghost" onClick={() => setStatus(s.id, 'Available')}>Restore</Btn>
            </Card>)}
          {!consumed.length && <div style={{
          fontSize: 13,
          color: T.textMuted,
          padding: '1rem 0'
        }}>Nothing reserved.</div>}
        </div>
      </div>
    </div>;
}

/* ════════════════════════════════════════
   STANDARD PARTS LIBRARY
════════════════════════════════════════ */