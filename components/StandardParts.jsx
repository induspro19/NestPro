import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ICONS, NAV, T, Icon, Btn, Card, Badge, Input, Select, Field, SectionHeader, EmptyState, Modal, StatCard, UtilArc } from './ui.jsx';
import { uid, fmt, fmtCurrency, parseCsvParts, blankDraft, SEED_MATERIALS, SEED_STANDARD_PARTS } from '../utils/helper.js';
import { downloadDxf, parseDxfDimensions } from '../utils/dxfExport.js';
import { runOptimization, runGeneticOptimizationAsync, packSecondaryParts, collectScrapCandidates, aiQualityScore, aiAutoSelectAlgorithm, breakdownBySize } from '../utils/nestingAlgorithm.js';
import { storeGet, storeSet, storeDelete, cloudSave, cloudLoad } from '../services/storage.js';

export default function StandardPartsPanel({
  standardPartsLibrary,
  setStandardPartsLibrary,
  persist
}) {
  const [editing, setEditing] = useState(null);
  const handleDxfUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dims = await parseDxfDimensions(file);
      setEditing(p => ({
        ...p,
        length: dims.length,
        width: dims.width,
        partNo: p.partNo || file.name.replace(/\.[^/.]+$/, "")
      }));
    } catch (err) {
      alert("Failed to parse DXF: " + err.message);
    }
    e.target.value = '';
  };
  const blank = () => ({
    id: uid('sp'),
    partNo: '',
    name: '',
    length: 0,
    width: 0,
    qty: 0,
    priority: 'Normal',
    allowRotation: true,
    shapeType: 'rectangle',
    cutoutLength: 0,
    cutoutWidth: 0,
    sideA: 0,
    sideB: 0,
    materialName: '',
    thickness: 3,
    currentStock: 0,
    targetStock: 0
  });
  const save = p => {
    const exists = standardPartsLibrary.some(x => x.id === p.id);
    const next = exists ? standardPartsLibrary.map(x => x.id === p.id ? p : x) : [p, ...standardPartsLibrary];
    setStandardPartsLibrary(next);
    persist('standard-parts', next);
    setEditing(null);
  };
  const remove = id => {
    const next = standardPartsLibrary.filter(x => x.id !== id);
    setStandardPartsLibrary(next);
    persist('standard-parts', next);
  };
  return <div className="slide-up">
      <SectionHeader eyebrow="Master Data" title="Standard Parts Library" action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Standard Part</Btn>} />
      {standardPartsLibrary.length === 0 ? <Card><EmptyState title="No standard parts" body="Add parts that you frequently manufacture for stock recovery." action={<Btn icon="plus" onClick={() => setEditing(blank())}>Add Part</Btn>} /></Card> : <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
      gap: 12
    }}>
          {standardPartsLibrary.map(p => <Card key={p.id}>
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
            }}>{p.partNo}</div>
                  <div style={{
              fontSize: 13,
              color: T.textDim,
              marginTop: 2
            }}>{p.name}</div>
                </div>
                <div style={{
            display: 'flex',
            gap: 4
          }}>
                  <button onClick={() => setEditing(p)} style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.blue
            }}><Icon d={ICONS.gear} size={15} /></button>
                  <button onClick={() => remove(p.id)} style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: T.red
            }}><Icon d={ICONS.trash} size={15} /></button>
                </div>
              </div>
              
              <div style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8
        }}>
                <Badge color={T.blue}>{p.shapeType || 'rectangle'}</Badge>
                <Badge color={T.purple}>{p.length} × {p.width} mm</Badge>
                <Badge color={p.priority === 'High' ? T.orange : p.priority === 'Medium' ? T.blue : T.textMuted}>Pri: {p.priority}</Badge>
              </div>
              
              <div style={{
          marginTop: 10,
          fontSize: 12,
          color: T.textMuted
        }}>
                <div><strong style={{
              color: T.text
            }}>Material:</strong> {p.materialName || 'Any'} ({p.thickness}mm)</div>
                <div style={{
            marginTop: 4,
            display: 'flex',
            justifyContent: 'space-between'
          }}>
                  <span><strong style={{
                color: T.text
              }}>Stock:</strong> {p.currentStock} / {p.targetStock}</span>
                  <span style={{
              color: p.currentStock < p.targetStock ? T.orange : T.green
            }}>{p.currentStock < p.targetStock ? 'Restock Needed' : 'Fully Stocked'}</span>
                </div>
              </div>
            </Card>)}
        </div>}
      
      {editing && <Modal title={editing.partNo ? 'Edit Standard Part' : 'Add Standard Part'} onClose={() => setEditing(null)}>
          <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: `${T.panel}`,
        padding: 12,
        borderRadius: 8,
        border: `1px dashed ${T.blue}`
      }}>
            <div>
              <div style={{
            fontFamily: T.fontDisplay,
            fontSize: 14,
            fontWeight: 700,
            color: T.text
          }}>Upload DXF</div>
              <div style={{
            fontSize: 11,
            color: T.textMuted
          }}>Auto-extracts length and width from drawing bounds</div>
            </div>
            <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: `${T.blue}20`,
          color: T.blue,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: '0.15s'
        }}>
              <Icon d={ICONS.upload} size={14} color={T.blue} /> Browse File
              <input type="file" accept=".dxf" style={{
            display: 'none'
          }} onChange={handleDxfUpload} />
            </label>
          </div>
          <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }}>
            <Field label="Part No"><Input value={editing.partNo} onChange={e => setEditing(p => ({
            ...p,
            partNo: e.target.value
          }))} /></Field>
            <Field label="Name"><Input value={editing.name} onChange={e => setEditing(p => ({
            ...p,
            name: e.target.value
          }))} /></Field>
            
            <Field label="Shape">
              <Select value={editing.shapeType || 'rectangle'} onChange={e => setEditing(p => ({
            ...p,
            shapeType: e.target.value
          }))}>
                <option value="rectangle">Rectangle</option>
                <option value="lshape">L-Shape</option>
                <option value="circle">Circle</option>
                <option value="triangle">Triangle</option>
                <option value="trapezoid">Trapezoid</option>
              </Select>
            </Field>
            
            <Field label="Priority">
              <Select value={editing.priority} onChange={e => setEditing(p => ({
            ...p,
            priority: e.target.value
          }))}>
                <option>High</option><option>Medium</option><option>Low</option>
              </Select>
            </Field>
            
            <Field label="Length (mm)"><Input type="number" value={editing.length} onChange={e => setEditing(p => ({
            ...p,
            length: parseFloat(e.target.value) || 0
          }))} /></Field>
            <Field label="Width (mm)"><Input type="number" value={editing.width} onChange={e => setEditing(p => ({
            ...p,
            width: parseFloat(e.target.value) || 0
          }))} /></Field>
            
            <Field label="Material Name" hint="Must match exactly (e.g. Stainless Steel (SS304 2B))"><Input value={editing.materialName} onChange={e => setEditing(p => ({
            ...p,
            materialName: e.target.value
          }))} placeholder="Stainless Steel (SS304 2B)" /></Field>
            <Field label="Thickness (mm)"><Input type="number" value={editing.thickness} onChange={e => setEditing(p => ({
            ...p,
            thickness: parseFloat(e.target.value) || 0
          }))} /></Field>

            <Field label="Current Stock"><Input type="number" value={editing.currentStock} onChange={e => setEditing(p => ({
            ...p,
            currentStock: parseInt(e.target.value) || 0
          }))} /></Field>
            <Field label="Target Stock"><Input type="number" value={editing.targetStock} onChange={e => setEditing(p => ({
            ...p,
            targetStock: parseInt(e.target.value) || 0
          }))} /></Field>
          </div>
          
          {editing.shapeType === 'lshape' && <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginTop: 12
      }}>
              <Field label="Cutout Length (mm)"><Input type="number" value={editing.cutoutLength} onChange={e => setEditing(p => ({
            ...p,
            cutoutLength: parseFloat(e.target.value) || 0
          }))} /></Field>
              <Field label="Cutout Width (mm)"><Input type="number" value={editing.cutoutWidth} onChange={e => setEditing(p => ({
            ...p,
            cutoutWidth: parseFloat(e.target.value) || 0
          }))} /></Field>
            </div>}
          
          {editing.shapeType === 'trapezoid' && <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginTop: 12
      }}>
              <Field label="Side A (mm)"><Input type="number" value={editing.sideA} onChange={e => setEditing(p => ({
            ...p,
            sideA: parseFloat(e.target.value) || 0
          }))} /></Field>
              <Field label="Side B (mm)"><Input type="number" value={editing.sideB} onChange={e => setEditing(p => ({
            ...p,
            sideB: parseFloat(e.target.value) || 0
          }))} /></Field>
            </div>}
          
          <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
        fontSize: 13,
        color: T.textDim,
        cursor: 'pointer'
      }}>
            <input type="checkbox" checked={editing.allowRotation !== false} onChange={e => setEditing(p => ({
          ...p,
          allowRotation: e.target.checked
        }))} />
            Allow 90° rotation
          </label>
          
          <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 20
      }}>
            <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn icon="save" onClick={() => save(editing)} disabled={!editing.partNo || !editing.length || !editing.width}>Save Part</Btn>
          </div>
        </Modal>}
    </div>;
}

/* ════════════════════════════════════════
   APP SHELL
════════════════════════════════════════ */