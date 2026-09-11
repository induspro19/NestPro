import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ICONS, NAV, T, Icon, Btn, Card, Badge, Input, Select, Field, SectionHeader, EmptyState, Modal, StatCard, UtilArc } from './ui.jsx';
import { uid, fmt, fmtCurrency, parseCsvParts, blankDraft, SEED_MATERIALS, SEED_STANDARD_PARTS } from '../utils/helper.js';
import { downloadDxf, parseDxfDimensions } from '../utils/dxfExport.js';
import { JobReportModal } from './Reports.jsx';
import { runOptimization, runGeneticOptimizationAsync, packSecondaryParts, collectScrapCandidates, aiQualityScore, aiAutoSelectAlgorithm, breakdownBySize, cutAllowance, itemAreaSqm, buildItemsFromParts, PRIORITY_RANK } from '../utils/nestingAlgorithm.js';
import { storeGet, storeSet, storeDelete, cloudSave, cloudLoad } from '../services/storage.js';

export function NestingViewer({
  option,
  material,
  jobNo
}) {
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hoverId, setHoverId] = useState(null);
  const [showScrap, setShowScrap] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  useEffect(() => {
    setPage(0);
    setZoom(1);
    setHoverId(null);
  }, [option]);
  const sheet = option.sheets[page];
  if (!sheet) return null;
  const vbW = sheet.usableW,
    vbH = sheet.usableH;
  const pad = Math.max(vbW, vbH) * 0.02;
  const hoveredP = sheet.placements.find(p => p.instId === hoverId);

  // Heatmap: colour fill based on part density in region
  function partOpacity(p) {
    if (!showHeatmap) return 0.82;
    const density = sheet.placements.filter(q => Math.abs(q.x - p.x) < vbW * 0.25).length / sheet.placements.length;
    return 0.5 + density * 0.5;
  }
  function renderShape(p, hovered) {
    const stroke = hovered ? '#60a5fa' : '#0a0f1a';
    const sw = hovered ? vbW * 0.003 : vbW * 0.0015;
    const op = partOpacity(p);
    const fs = Math.min(p.w, p.h) * 0.18;
    const label = `${p.partNo}${p.rotated ? ' ↻' : ''}`;
    const st = p.shapeType || 'rectangle';
    if (st === 'circle') {
      return <g key={p.instId}><ellipse cx={p.x + p.w / 2} cy={p.y + p.h / 2} rx={p.w / 2} ry={p.h / 2} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    if (st === 'triangle' && p.shapeData) {
      const d = `M${p.x} ${p.y + p.h} L${p.x + p.w / 2} ${p.y} L${p.x + p.w} ${p.y + p.h} Z`;
      return <g key={p.instId}><path d={d} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x + p.w / 2} y={p.y + p.h * 0.7} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    if (st === 'trapezoid' && p.shapeData) {
      const {
        sideA = p.w,
        sideB = 0
      } = p.shapeData;
      const off = (p.w - sideB) / 2;
      const d = `M${p.x} ${p.y + p.h} L${p.x + p.w} ${p.y + p.h} L${p.x + p.w - off} ${p.y} L${p.x + off} ${p.y} Z`;
      return <g key={p.instId}><path d={d} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    if (st === 'lshape' && p.shapeData) {
      const {
        cutoutLength: cl = 0,
        cutoutWidth: cw = 0
      } = p.shapeData;
      const d = `M${p.x} ${p.y} H${p.x + p.w} V${p.y + cw} H${p.x + p.w - cl} V${p.y + p.h} H${p.x} Z`;
      return <g key={p.instId}><path d={d} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
    }
    return <g key={p.instId}><rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.color} fillOpacity={op} stroke={stroke} strokeWidth={sw} /><text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
  }
  return <Card>
      <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12
    }}>
        <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
          <span style={{
          fontFamily: T.fontDisplay,
          fontSize: 16,
          fontWeight: 700,
          color: T.text
        }}>Nesting Preview</span>
          {sheet.source === 'scrap' && <Badge color={T.green}>REUSED SCRAP {sheet.scrapLabel ? `· ${sheet.scrapLabel}` : ''}</Badge>}
        </div>
        <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap'
      }}>
          {/* Toggle overlays */}
          <button onClick={() => setShowScrap(v => !v)} style={{
          padding: '4px 10px',
          borderRadius: 5,
          border: `1px solid ${showScrap ? T.orange : T.border}`,
          background: showScrap ? `${T.orange}20` : T.panel,
          color: showScrap ? T.orange : T.textMuted,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: T.fontBody
        }}>Scrap Zones</button>
          <button onClick={() => setShowHeatmap(v => !v)} style={{
          padding: '4px 10px',
          borderRadius: 5,
          border: `1px solid ${showHeatmap ? T.red : T.border}`,
          background: showHeatmap ? `${T.red}20` : T.panel,
          color: showHeatmap ? T.red : T.textMuted,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: T.fontBody
        }}>Heatmap</button>
          <div style={{
          width: 1,
          height: 20,
          background: T.border
        }} />
          <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} style={{
          padding: 6,
          borderRadius: 5,
          background: T.panel,
          border: `1px solid ${T.border}`,
          cursor: 'pointer',
          color: T.textDim
        }}><Icon d={ICONS.zoomOut} size={14} /></button>
          <span style={{
          fontSize: 12,
          fontFamily: T.fontMono,
          color: T.textMuted,
          minWidth: 38,
          textAlign: 'center'
        }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} style={{
          padding: 6,
          borderRadius: 5,
          background: T.panel,
          border: `1px solid ${T.border}`,
          cursor: 'pointer',
          color: T.textDim
        }}><Icon d={ICONS.zoomIn} size={14} /></button>
          <div style={{
          width: 1,
          height: 20,
          background: T.border
        }} />
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{
          padding: 6,
          borderRadius: 5,
          background: T.panel,
          border: `1px solid ${T.border}`,
          cursor: 'pointer',
          color: T.textDim,
          opacity: page === 0 ? 0.3 : 1
        }}><Icon d={ICONS.chevLeft} size={14} /></button>
          <span style={{
          fontSize: 12,
          fontFamily: T.fontMono,
          color: T.text,
          minWidth: 70,
          textAlign: 'center'
        }}>Sheet {page + 1} / {option.sheets.length}</span>
          <button disabled={page === option.sheets.length - 1} onClick={() => setPage(p => p + 1)} style={{
          padding: 6,
          borderRadius: 5,
          background: T.panel,
          border: `1px solid ${T.border}`,
          cursor: 'pointer',
          color: T.textDim,
          opacity: page === option.sheets.length - 1 ? 0.3 : 1
        }}><Icon d={ICONS.chevRight} size={14} /></button>
          <div style={{
          width: 1,
          height: 20,
          background: T.border
        }} />
          <Btn size="sm" icon="save" onClick={() => downloadDxf(option, material, jobNo)}>DXF</Btn>
        </div>
      </div>

      <div style={{
      background: '#05070a',
      borderRadius: 8,
      overflow: 'auto',
      maxHeight: 520,
      border: `1px solid ${T.border}`
    }}>
        <svg viewBox={`${-pad} ${-pad} ${vbW + pad * 2} ${vbH + pad * 2}`} width={vbW * zoom * 0.35} height={vbH * zoom * 0.35} style={{
        display: 'block',
        margin: '16px auto'
      }}>
          {/* Sheet background */}
          <rect x={0} y={0} width={vbW} height={vbH} fill="#0d1117" stroke={T.blue} strokeWidth={vbW * 0.0025} />
          {/* Grid lines */}
          {Array.from({
          length: Math.floor(vbW / 100)
        }, (_, i) => (i + 1) * 100).map(x => <line key={x} x1={x} y1={0} x2={x} y2={vbH} stroke="#1e2a3a" strokeWidth={vbW * 0.0006} />)}
          {Array.from({
          length: Math.floor(vbH / 100)
        }, (_, i) => (i + 1) * 100).map(y => <line key={y} x1={0} y1={y} x2={vbW} y2={y} stroke="#1e2a3a" strokeWidth={vbW * 0.0006} />)}
          {/* Scrap zones */}
          {showScrap && sheet.freeRects?.map((r, i) => r.w > 20 && r.h > 20 && <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={`${T.orange}10`} stroke={T.orange} strokeWidth={vbW * 0.0008} strokeDasharray={`${vbW * 0.008} ${vbW * 0.004}`} />)}
          {/* Parts */}
          {sheet.placements.map(p => <g key={p.instId} onMouseEnter={() => setHoverId(p.instId)} onMouseLeave={() => setHoverId(h => h === p.instId ? null : h)} style={{
          cursor: 'pointer'
        }}>
              {renderShape(p, hoverId === p.instId)}
              {hoverId === p.instId && <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="none" stroke="#60a5fa" strokeWidth={vbW * 0.003} rx={2} />}
              <title>{`${p.partNo} — ${Math.round(p.w)} × ${Math.round(p.h)} mm${p.rotated ? ' (rotated)' : ''}${p.priority && p.priority !== 'Normal' ? ' · ' + p.priority : ''}`}</title>
            </g>)}
          {/* Hover tooltip */}
          {hoveredP && (() => {
          const fs = Math.max(vbW, vbH) * 0.022;
          const label = `${hoveredP.partNo} — ${Math.round(hoveredP.w)} × ${Math.round(hoveredP.h)} mm${hoveredP.rotated ? ' (rotated)' : ''}`;
          const bw = Math.min(vbW * 0.9, label.length * fs * 0.6 + fs * 1.5);
          let bx = hoveredP.x + hoveredP.w / 2 - bw / 2,
            by = hoveredP.y - fs * 2.5;
          if (by < 0) by = hoveredP.y + hoveredP.h + fs * 0.5;
          if (bx < 0) bx = 0;
          if (bx + bw > vbW) bx = vbW - bw;
          return <g pointerEvents="none"><rect x={bx} y={by} width={bw} height={fs * 2} rx={fs * 0.3} fill="#060a10" fillOpacity={0.95} stroke={T.blue} strokeWidth={vbW * 0.001} /><text x={bx + bw / 2} y={by + fs} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fill="#fff" fontFamily={T.fontMono} fontWeight="700">{label}</text></g>;
        })()}
        </svg>
      </div>
      <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8
    }}>
        <span style={{
        fontSize: 12,
        color: T.textMuted
      }}>{sheet.placements.length} parts · {vbW} × {vbH} mm usable area</span>
        {showScrap && <span style={{
        fontSize: 12,
        color: T.orange
      }}>▪ Orange = available scrap zones</span>}
      </div>
    </Card>;
}

/* ════════════════════════════════════════
   RESULTS PANEL
════════════════════════════════════════ */
export function NewJobPanel({
  materials,
  scrapInventory,
  onOptimize,
  draft,
  setDraft,
  optimizing,
  optimizeProgress
}) {
  const material = materials.find(m => m.id === draft.materialId) || null;
  const fileRef = useRef(null);
  const set = (k, v) => setDraft(d => ({
    ...d,
    [k]: v
  }));
  const toggleSize = id => setDraft(d => ({
    ...d,
    selectedSizeIds: d.selectedSizeIds.includes(id) ? d.selectedSizeIds.filter(x => x !== id) : [...d.selectedSizeIds, id]
  }));
  const toggleScrap = id => setDraft(d => ({
    ...d,
    selectedScrapIds: (d.selectedScrapIds || []).includes(id) ? (d.selectedScrapIds || []).filter(x => x !== id) : [...(d.selectedScrapIds || []), id]
  }));
  const addPart = () => setDraft(d => ({
    ...d,
    parts: [...d.parts, {
      id: uid('p'),
      partNo: `P${d.parts.length + 1}`,
      length: 0,
      width: 0,
      qty: 1,
      priority: 'Normal',
      allowRotation: true,
      shapeType: 'rectangle',
      cutoutLength: 0,
      cutoutWidth: 0,
      sideA: 0,
      sideB: 0
    }]
  }));
  const updPart = (id, k, v) => setDraft(d => ({
    ...d,
    parts: d.parts.map(p => p.id === id ? {
      ...p,
      [k]: v
    } : p)
  }));
  const rmPart = id => setDraft(d => ({
    ...d,
    parts: d.parts.filter(p => p.id !== id)
  }));
  const handleFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const p = parseCsvParts(String(r.result));
      if (p.length) setDraft(d => ({
        ...d,
        parts: [...d.parts.filter(p => p.length && p.width), ...p]
      }));
    };
    r.readAsText(f);
    e.target.value = '';
  };
  const matchingScrap = material ? scrapInventory.filter(s => s.status !== 'Used' && parseFloat(s.thickness) === parseFloat(material.thickness)) : [];
  const selectedScrapIds = draft.selectedScrapIds || [];
  const selectedSizes = material ? material.sheetSizes.filter(s => draft.selectedSizeIds.includes(s.id)) : [];
  const selectedScrapPieces = matchingScrap.filter(s => selectedScrapIds.includes(s.id));
  const canRun = material && (selectedSizes.length > 0 || selectedScrapPieces.length > 0) && draft.parts.some(p => p.length > 0 && p.width > 0 && p.qty > 0);
  const aiSuggested = material ? aiAutoSelectAlgorithm(draft.parts) : null;
  return <div className="slide-up">
      <SectionHeader eyebrow="Nesting" title="New Nesting Job" />
      <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginBottom: 12
    }}>
        <Card>
          <div style={{
          fontFamily: T.fontDisplay,
          fontSize: 15,
          fontWeight: 700,
          color: T.text,
          marginBottom: 12
        }}>Job Details</div>
          <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 12
        }}>
            <Field label="Job Number"><Input value={draft.jobNo} onChange={e => set('jobNo', e.target.value)} /></Field>
            <Field label="Project"><Input value={draft.project} onChange={e => set('project', e.target.value)} placeholder="Fire Panel Batch 12" /></Field>
            <Field label="Customer"><Input value={draft.customer} onChange={e => set('customer', e.target.value)} /></Field>
            <Field label="Material">
              <Select value={draft.materialId} onChange={e => set('materialId', e.target.value)}>
                <option value="">Select material…</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name} · {m.grade} · {m.thickness}mm</option>)}
              </Select>
            </Field>
          </div>
          {material && <div>
              <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: T.textMuted,
            textTransform: 'uppercase',
            marginBottom: 8
          }}>Candidate Sheet Sizes</div>
              <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6
          }}>
                {material.sheetSizes.map(s => <label key={s.id} style={{
              cursor: 'pointer'
            }}>
                    <input type="checkbox" style={{
                display: 'none'
              }} checked={draft.selectedSizeIds.includes(s.id)} onChange={() => toggleSize(s.id)} />
                    <span style={{
                display: 'inline-block',
                padding: '5px 10px',
                borderRadius: 6,
                fontFamily: T.fontMono,
                fontSize: 12,
                background: draft.selectedSizeIds.includes(s.id) ? T.blue : T.panel,
                color: draft.selectedSizeIds.includes(s.id) ? '#fff' : T.textDim,
                border: `1px solid ${draft.selectedSizeIds.includes(s.id) ? T.blue : T.border}`,
                transition: '0.15s'
              }}>{s.l} × {s.w}</span>
                  </label>)}
              </div>
            </div>}
        </Card>

        <Card>
          <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12
        }}>
            <div style={{
            fontFamily: T.fontDisplay,
            fontSize: 15,
            fontWeight: 700,
            color: T.text
          }}>Optimization Settings</div>
            {aiSuggested && <Badge color={T.green}>AI: Use {aiSuggested === 'genetic' ? 'Deep' : 'Fast'}</Badge>}
          </div>
          <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10
        }}>
            <Field label="Engine Mode">
              <Select value={draft.settings.optimizeMode || 'fast'} onChange={e => setDraft(d => ({
              ...d,
              settings: {
                ...d.settings,
                optimizeMode: e.target.value
              }
            }))}>
                <option value="fast">Fast — BSSF Greedy</option>
                <option value="genetic">Deep — Genetic Search</option>
              </Select>
            </Field>
            <Field label="Genetic Generations" hint={draft.settings.optimizeMode === 'genetic' ? 'More = better, slower' : 'Only in Deep mode'}>
              <Input type="number" value={draft.settings.gaGenerations || 80} disabled={draft.settings.optimizeMode !== 'genetic'} onChange={e => setDraft(d => ({
              ...d,
              settings: {
                ...d.settings,
                gaGenerations: parseInt(e.target.value) || 80
              }
            }))} />
            </Field>
            <Field label="Laser Kerf (mm)"><Input type="number" value={draft.settings.kerf} onChange={e => setDraft(d => ({
              ...d,
              settings: {
                ...d.settings,
                kerf: parseFloat(e.target.value) || 0
              }
            }))} /></Field>
            <Field label="Part Gap (mm)"><Input type="number" value={draft.settings.gap} onChange={e => setDraft(d => ({
              ...d,
              settings: {
                ...d.settings,
                gap: parseFloat(e.target.value) || 0
              }
            }))} /></Field>
            <Field label="Edge Margin (mm)"><Input type="number" value={draft.settings.margin} onChange={e => setDraft(d => ({
              ...d,
              settings: {
                ...d.settings,
                margin: parseFloat(e.target.value) || 0
              }
            }))} /></Field>
            <Field label="Min Reusable Scrap (mm)"><Input type="number" value={draft.settings.minScrap} onChange={e => setDraft(d => ({
              ...d,
              settings: {
                ...d.settings,
                minScrap: parseFloat(e.target.value) || 0
              }
            }))} /></Field>
          </div>
          <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 10,
          fontSize: 13,
          color: T.textDim,
          cursor: 'pointer'
        }}>
            <input type="checkbox" checked={draft.settings.allowRotation} onChange={e => setDraft(d => ({
            ...d,
            settings: {
              ...d.settings,
              allowRotation: e.target.checked
            }
          }))} />
            Allow 90° rotation (rectangles)
          </label>
        </Card>
      </div>

      {material && matchingScrap.length > 0 && <Card style={{
      marginBottom: 12
    }}>
          <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
      }}>
            <Icon d={ICONS.scrap} size={15} color={T.green} />
            <span style={{
          fontFamily: T.fontDisplay,
          fontSize: 14,
          fontWeight: 700,
          color: T.text
        }}>Reuse Scrap Inventory</span>
            <Badge color={T.green}>{matchingScrap.length} available at {material.thickness}mm</Badge>
          </div>
          <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }}>
            {matchingScrap.map(s => <label key={s.id} style={{
          cursor: 'pointer'
        }}>
                <input type="checkbox" style={{
            display: 'none'
          }} checked={selectedScrapIds.includes(s.id)} onChange={() => toggleScrap(s.id)} />
                <span style={{
            display: 'inline-block',
            padding: '5px 10px',
            borderRadius: 6,
            fontFamily: T.fontMono,
            fontSize: 12,
            background: selectedScrapIds.includes(s.id) ? T.green : T.panel,
            color: selectedScrapIds.includes(s.id) ? '#fff' : T.textDim,
            border: `1px solid ${selectedScrapIds.includes(s.id) ? T.green : T.border}`,
            transition: '0.15s'
          }}>{s.length} × {s.width}</span>
              </label>)}
          </div>
        </Card>}

      <Card>
        <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
      }}>
          <span style={{
          fontFamily: T.fontDisplay,
          fontSize: 15,
          fontWeight: 700,
          color: T.text
        }}>Parts List <span style={{
            fontSize: 13,
            fontWeight: 400,
            color: T.textMuted
          }}>({draft.parts.length} rows · {fmt(draft.parts.reduce((s, p) => s + (parseInt(p.qty) || 0), 0))} pcs)</span></span>
          <div style={{
          display: 'flex',
          gap: 8
        }}>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{
            display: 'none'
          }} onChange={handleFile} />
            <Btn size="sm" variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>CSV</Btn>
            <Btn size="sm" variant="ghost" icon="plus" onClick={addPart}>Add Row</Btn>
          </div>
        </div>
        <div style={{
        overflowX: 'auto'
      }}>
          <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13
        }}>
            <thead>
              <tr style={{
              color: T.textMuted,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>
                {['Part No', 'Shape', 'Length', 'Width', 'Extra', 'Qty', 'Priority', 'Rotate', ''].map((h, i) => <th key={i} style={{
                textAlign: 'left',
                paddingBottom: 8,
                paddingRight: 8,
                fontWeight: 600
              }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {draft.parts.map(p => <tr key={p.id} style={{
              borderTop: `1px solid ${T.border}`
            }}>
                  <td style={{
                padding: '6px 8px 6px 0'
              }}><Input value={p.partNo} onChange={e => updPart(p.id, 'partNo', e.target.value)} style={{
                  width: 90
                }} /></td>
                  <td style={{
                paddingRight: 8
              }}>
                    <Select value={p.shapeType || 'rectangle'} onChange={e => updPart(p.id, 'shapeType', e.target.value)} style={{
                  width: 110
                }}>
                      <option value="rectangle">Rectangle</option>
                      <option value="lshape">L-Shape</option>
                      <option value="circle">Circle</option>
                      <option value="triangle">Triangle</option>
                      <option value="trapezoid">Trapezoid</option>
                    </Select>
                  </td>
                  <td style={{
                paddingRight: 8
              }}><Input type="number" value={p.length} onChange={e => updPart(p.id, 'length', parseFloat(e.target.value) || 0)} style={{
                  width: 80
                }} /></td>
                  <td style={{
                paddingRight: 8
              }}><Input type="number" value={p.width} onChange={e => updPart(p.id, 'width', parseFloat(e.target.value) || 0)} style={{
                  width: 80
                }} /></td>
                  <td style={{
                paddingRight: 8
              }}>
                    {p.shapeType === 'lshape' && <div style={{
                  display: 'flex',
                  gap: 4
                }}>
                        <Input type="number" value={p.cutoutLength || 0} onChange={e => updPart(p.id, 'cutoutLength', parseFloat(e.target.value) || 0)} style={{
                    width: 58
                  }} />
                        <Input type="number" value={p.cutoutWidth || 0} onChange={e => updPart(p.id, 'cutoutWidth', parseFloat(e.target.value) || 0)} style={{
                    width: 58
                  }} />
                      </div>}
                    {p.shapeType === 'trapezoid' && <div style={{
                  display: 'flex',
                  gap: 4
                }}>
                        <Input type="number" value={p.sideA || 0} onChange={e => updPart(p.id, 'sideA', parseFloat(e.target.value) || 0)} style={{
                    width: 58
                  }} placeholder="A" />
                        <Input type="number" value={p.sideB || 0} onChange={e => updPart(p.id, 'sideB', parseFloat(e.target.value) || 0)} style={{
                    width: 58
                  }} placeholder="B" />
                      </div>}
                    {!['lshape', 'trapezoid'].includes(p.shapeType) && <span style={{
                  fontSize: 11,
                  color: T.textMuted
                }}>—</span>}
                  </td>
                  <td style={{
                paddingRight: 8
              }}><Input type="number" value={p.qty} onChange={e => updPart(p.id, 'qty', parseInt(e.target.value) || 0)} style={{
                  width: 60
                }} /></td>
                  <td style={{
                paddingRight: 8
              }}>
                    <Select value={p.priority} onChange={e => updPart(p.id, 'priority', e.target.value)} style={{
                  width: 90
                }}>
                      <option>Urgent</option><option>Normal</option><option>Low</option>
                    </Select>
                  </td>
                  <td style={{
                paddingRight: 8,
                textAlign: 'center'
              }}>
                    <input type="checkbox" checked={p.allowRotation !== false && (p.shapeType || 'rectangle') === 'rectangle'} disabled={(p.shapeType || 'rectangle') !== 'rectangle'} onChange={e => updPart(p.id, 'allowRotation', e.target.checked)} />
                  </td>
                  <td><button onClick={() => rmPart(p.id)} style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: T.red
                }}><Icon d={ICONS.trash} size={14} /></button></td>
                </tr>)}
            </tbody>
          </table>
          {!draft.parts.length && <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: T.textMuted,
          fontSize: 13
        }}>No parts yet — add a row or upload a CSV.</div>}
        </div>
      </Card>

      <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
      marginTop: 16
    }}>
        {optimizing && <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: T.orange,
        fontFamily: T.fontMono
      }}>
            <Icon d={ICONS.loader} size={14} color={T.orange} style={{
          animation: 'spin 1s linear infinite'
        }} />
            {draft.settings.optimizeMode === 'genetic' ? `Genetic search ${optimizeProgress || 0}%` : 'Optimizing…'}
          </div>}
        <Btn icon="newjob" disabled={!canRun || optimizing} onClick={() => onOptimize(material, selectedSizes, selectedScrapPieces)}>
          {draft.settings.optimizeMode === 'genetic' ? 'Run Deep Optimization' : 'Run Optimization'}
        </Btn>
      </div>
    </div>;
}

/* ════════════════════════════════════════
   NESTING VIEWER — Enhanced Dark Canvas
════════════════════════════════════════ */
export function ResultsPanel({
  results,
  setResults,
  draft,
  material,
  onSaveJob,
  onSaveScrap,
  savedState,
  standardPartsLibrary
}) {
  const [chosenIdx, setChosenIdx] = useState(0);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => setChosenIdx(0), [results]);
  if (!results?.length) return null;
  const chosen = results[chosenIdx];
  const scrapCandidates = collectScrapCandidates(chosen, draft.settings.minScrap || 300);
  const ai = aiQualityScore(chosen);
  const [showSecondaryModal, setShowSecondaryModal] = useState(false);
  const [secondaryCandidates, setSecondaryCandidates] = useState([]);
  const openSecondaryModal = () => {
    if (!material) return;
    const candidates = standardPartsLibrary.filter(sp => sp.materialName === `${material.name} (${material.grade})` && parseFloat(sp.thickness) === parseFloat(material.thickness));
    // Calculate max fit
    const candsWithFit = candidates.map(c => {
      const testParts = [{
        ...c,
        qty: 500
      }];
      const {
        sheets,
        unplaced
      } = packSecondaryParts(chosen.sheets, testParts, draft.settings, {
        engineTag: 'bssf'
      });
      const placedCount = 500 - unplaced.length;
      return {
        ...c,
        fitQty: placedCount,
        suggestedQty: Math.min(placedCount, Math.max(0, c.targetStock - c.currentStock) || placedCount)
      };
    }).filter(c => c.fitQty > 0);
    candsWithFit.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.fitQty - a.fitQty);
    setSecondaryCandidates(candsWithFit);
    setShowSecondaryModal(true);
  };
  const handleGenerateSecondary = () => {
    const partsToPack = secondaryCandidates.filter(c => c.suggestedQty > 0).map(c => ({
      ...c,
      qty: c.suggestedQty
    }));
    if (!partsToPack.length) {
      setShowSecondaryModal(false);
      return;
    }
    const {
      sheets,
      unplaced
    } = packSecondaryParts(chosen.sheets, partsToPack, draft.settings, {
      engineTag: 'bssf'
    });
    const placed = partsToPack.reduce((s, p) => s + p.qty, 0) - unplaced.length;
    const newChosen = {
      ...chosen
    };
    newChosen.sheets = sheets;
    const addedArea = itemAreaSqm(buildItemsFromParts(partsToPack, draft.settings)) * (partsToPack.length ? placed / partsToPack.reduce((s, p) => s + p.qty, 0) : 0);
    newChosen.partArea += addedArea;
    newChosen.utilization = newChosen.totalSheetArea > 0 ? Math.min(100, newChosen.partArea / newChosen.totalSheetArea * 100) : 0;
    newChosen.scrapPct = newChosen.totalSheetArea > 0 ? 100 - newChosen.utilization : 0;
    newChosen.secondaryPartsPlaced = (newChosen.secondaryPartsPlaced || 0) + placed;
    const nextResults = [...results];
    nextResults[chosenIdx] = newChosen;
    setResults(nextResults);
    setShowSecondaryModal(false);
  };
  return <div className="slide-up">
      <SectionHeader eyebrow="Results" title={`Optimization — ${draft.jobNo}`} action={<Btn icon="report" variant="ghost" onClick={() => setShowReport(true)}>Job Report</Btn>} />

      {/* AI Score Banner */}
      <div style={{
      background: `${ai.color}15`,
      border: `1px solid ${ai.color}40`,
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
        <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
          <Icon d={ICONS.brain} size={20} color={ai.color} />
          <div>
            <span style={{
            fontFamily: T.fontDisplay,
            fontSize: 16,
            fontWeight: 700,
            color: ai.color
          }}>AI Quality: {ai.grade}</span>
            <span style={{
            marginLeft: 12,
            fontSize: 13,
            color: T.textMuted
          }}>{ai.reason}</span>
          </div>
        </div>
        <div style={{
        fontFamily: T.fontDisplay,
        fontSize: 24,
        fontWeight: 700,
        color: ai.color
      }}>{ai.score}/100</div>
      </div>

      
      {/* Secondary Nest Opportunity */}
      {scrapCandidates.length > 0 && !chosen.secondaryPartsPlaced && <div style={{
      background: `${T.green}15`,
      border: `1px solid ${T.green}40`,
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
          <div>
            <div style={{
          fontFamily: T.fontDisplay,
          fontSize: 16,
          fontWeight: 700,
          color: T.green
        }}>AI Opportunity Found</div>
            <div style={{
          fontSize: 13,
          color: T.textMuted,
          marginTop: 4
        }}>You have enough reusable scrap area to manufacture standard stock parts.</div>
          </div>
          <Btn variant="success" icon="plus" onClick={openSecondaryModal}>Fill Remaining Space</Btn>
        </div>}
      
      {chosen.secondaryPartsPlaced > 0 && <div style={{
      background: `${T.purple}15`,
      border: `1px solid ${T.purple}40`,
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
          <div>
            <div style={{
          fontFamily: T.fontDisplay,
          fontSize: 16,
          fontWeight: 700,
          color: T.purple
        }}>Secondary Nest Completed</div>
            <div style={{
          fontSize: 13,
          color: T.textMuted,
          marginTop: 4
        }}>Added {chosen.secondaryPartsPlaced} standard parts into the unused scrap area. Material saved!</div>
          </div>
        </div>}

      {/* Result Cards */}
      <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
      gap: 10,
      marginBottom: 16
    }}>
        {results.map((r, i) => {
        const rAi = aiQualityScore(r);
        return <div key={i} onClick={() => setChosenIdx(i)} style={{
          cursor: 'pointer',
          background: T.card,
          border: `2px solid ${chosenIdx === i ? T.blue : T.border}`,
          borderRadius: 10,
          padding: '1rem',
          transition: '0.15s',
          boxShadow: chosenIdx === i ? `0 0 16px ${T.blue}30` : 'none'
        }}>
              <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8
          }}>
                <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
                  <span style={{
                fontFamily: T.fontMono,
                fontSize: 12,
                fontWeight: 700,
                color: T.text
              }}>
                    {r.mixed && <Badge color={T.purple}>MIX</Badge>} {r.sizeLabel}
                  </span>
                  {r.mixed && r.sizeBreakdown && r.sizeBreakdown.length > 0 && <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4
              }}>
                      {r.sizeBreakdown.map(b => <span key={`${b.l}x${b.w}`} style={{
                  fontSize: 10,
                  fontFamily: T.fontMono,
                  background: T.panel,
                  color: T.textDim,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: `1px solid ${T.border}`
                }}>
                          {b.count}× {b.l}×{b.w}
                        </span>)}
                    </div>}
                </div>
                {i === 0 && <Badge color={T.green}>✓ BEST</Badge>}
              </div>
              <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 4,
            textAlign: 'center'
          }}>
                <div><div style={{
                fontFamily: T.fontDisplay,
                fontSize: 20,
                fontWeight: 700,
                color: T.text
              }}>{r.sheetsUsed}</div><div style={{
                fontSize: 10,
                color: T.textMuted,
                textTransform: 'uppercase'
              }}>Sheets</div></div>
                <div><div style={{
                fontFamily: T.fontDisplay,
                fontSize: 20,
                fontWeight: 700,
                color: T.green
              }}>{fmt(r.utilization, 1)}%</div><div style={{
                fontSize: 10,
                color: T.textMuted,
                textTransform: 'uppercase'
              }}>Utilized</div></div>
                <div><div style={{
                fontFamily: T.fontDisplay,
                fontSize: 20,
                fontWeight: 700,
                color: rAi.color
              }}>{rAi.score}</div><div style={{
                fontSize: 10,
                color: T.textMuted,
                textTransform: 'uppercase'
              }}>AI Score</div></div>
              </div>
              <div style={{
            marginTop: 8,
            fontSize: 12,
            fontFamily: T.fontMono,
            color: T.textMuted
          }}>{fmtCurrency(r.cost)}</div>
              {r.unplaced?.length > 0 && <div style={{
            marginTop: 6,
            fontSize: 12,
            color: T.red,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}><Icon d={ICONS.warn} size={12} color={T.red} /> {r.unplaced.length} pcs unplaced</div>}
            </div>;
      })}
      </div>

      {/* Live Analytics */}
      <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: 12,
      marginBottom: 16
    }}>
        <Card style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 140
      }}>
          <UtilArc pct={chosen.utilization} size={130} />
        </Card>
        <Card>
          <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12
        }}>
            {[{
            label: 'Total Sheets',
            val: chosen.sheetsUsed,
            color: T.text
          }, {
            label: 'Fresh Sheets',
            val: chosen.freshSheetsUsed ?? chosen.sheetsUsed,
            color: T.blue
          }, {
            label: 'Scrap Reused',
            val: chosen.scrapSheetsUsed || 0,
            color: T.green
          }, {
            label: 'Material Cost',
            val: fmtCurrency(chosen.cost),
            color: T.orange
          }, {
            label: 'Parts Placed',
            val: `${chosen.placedCount} / ${chosen.totalPartsRequested}`,
            color: chosen.placedCount === chosen.totalPartsRequested ? T.green : T.red
          }, {
            label: 'Scrap %',
            val: `${fmt(chosen.scrapPct, 1)}%`,
            color: chosen.scrapPct < 20 ? T.green : T.orange
          }].map(m => <div key={m.label}>
                <div style={{
              fontSize: 11,
              color: T.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 4
            }}>{m.label}</div>
                <div style={{
              fontFamily: T.fontDisplay,
              fontSize: 20,
              fontWeight: 700,
              color: m.color
            }}>{m.val}</div>
              </div>)}
          </div>
          <div style={{
          marginTop: 12,
          fontSize: 12,
          color: T.textMuted
        }}>
            {material.name} ({material.grade}, {material.thickness}mm) · kerf {draft.settings.kerf}mm + gap {draft.settings.gap}mm = {cutAllowance(draft.settings)}mm cut allowance
            {chosen.engineTag === 'genetic' && <span style={{
            marginLeft: 8,
            color: T.purple,
            fontWeight: 600
          }}>· Genetic Engine</span>}
          </div>
        </Card>
      </div>

      <NestingViewer option={chosen} material={material} jobNo={draft.jobNo} />

      {scrapCandidates.length > 0 && <Card style={{
      marginTop: 12
    }}>
          <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
      }}>
            <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
              <Icon d={ICONS.scrap} size={15} color={T.green} />
              <span style={{
            fontFamily: T.fontDisplay,
            fontSize: 14,
            fontWeight: 700,
            color: T.text
          }}>Reusable Scrap Detected</span>
            </div>
            <Btn size="sm" variant="accent" onClick={() => onSaveScrap(scrapCandidates, material)}>Save {scrapCandidates.length} Pieces</Btn>
          </div>
          <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }}>
            {scrapCandidates.map((s, i) => <Badge key={i} color={T.green}>{s.length} × {s.width}</Badge>)}
          </div>
        </Card>}

      <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: 16
    }}>
        <Btn icon="save" variant="success" onClick={() => onSaveJob(chosen, material)} disabled={savedState === 'saved'}>
          {savedState === 'saved' ? '✓ Job Saved' : 'Save Job to History'}
        </Btn>
      </div>

      
      {showSecondaryModal && <Modal title="Standard Part Recommendation" onClose={() => setShowSecondaryModal(false)} wide>
          <div style={{
        marginBottom: 16,
        fontSize: 13,
        color: T.textMuted
      }}>
            The system analyzed the remaining {scrapCandidates.length} scrap zones. Below are standard parts from your library that match the current material ({material.name} {material.thickness}mm) and can fit inside the leftover area.
          </div>
          {secondaryCandidates.length === 0 ? <div style={{
        textAlign: 'center',
        padding: '2rem 0',
        color: T.textMuted,
        fontSize: 13
      }}>No compatible standard parts found in library that can fit in the remaining space.</div> : <div style={{
        overflowX: 'auto',
        marginBottom: 16
      }}>
              <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13
        }}>
                <thead>
                  <tr style={{
              color: T.textMuted,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: `1px solid ${T.border}`
            }}>
                    <th style={{
                textAlign: 'left',
                padding: '8px 0'
              }}>Part No</th>
                    <th style={{
                textAlign: 'left',
                padding: '8px 0'
              }}>Name</th>
                    <th style={{
                textAlign: 'center',
                padding: '8px 0'
              }}>Priority</th>
                    <th style={{
                textAlign: 'center',
                padding: '8px 0'
              }}>Stock</th>
                    <th style={{
                textAlign: 'center',
                padding: '8px 0',
                color: T.green
              }}>Max Fit</th>
                    <th style={{
                textAlign: 'right',
                padding: '8px 0'
              }}>Suggested Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {secondaryCandidates.map((c, i) => <tr key={c.id} style={{
              borderBottom: `1px solid ${T.borderLight}`
            }}>
                      <td style={{
                padding: '8px 0',
                fontFamily: T.fontMono,
                color: T.text
              }}>{c.partNo}</td>
                      <td style={{
                padding: '8px 0',
                color: T.textDim
              }}>{c.name}</td>
                      <td style={{
                padding: '8px 0',
                textAlign: 'center'
              }}>
                        <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: c.priority === 'High' ? T.orange : c.priority === 'Medium' ? T.blue : T.panel,
                  color: c.priority === 'Low' ? T.textMuted : '#fff'
                }}>{c.priority}</span>
                      </td>
                      <td style={{
                padding: '8px 0',
                textAlign: 'center',
                fontFamily: T.fontMono,
                color: T.textDim
              }}>{c.currentStock}/{c.targetStock}</td>
                      <td style={{
                padding: '8px 0',
                textAlign: 'center',
                fontFamily: T.fontMono,
                color: T.green,
                fontWeight: 700
              }}>{c.fitQty}</td>
                      <td style={{
                padding: '8px 0',
                textAlign: 'right'
              }}>
                        <Input type="number" min="0" max={c.fitQty} value={c.suggestedQty} onChange={e => {
                  const next = [...secondaryCandidates];
                  next[i].suggestedQty = Math.max(0, Math.min(c.fitQty, parseInt(e.target.value) || 0));
                  setSecondaryCandidates(next);
                }} style={{
                  width: 70,
                  textAlign: 'center'
                }} />
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>}
          <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16
      }}>
            <span style={{
          fontSize: 13,
          color: T.textDim
        }}>
              Adding <strong style={{
            color: T.text
          }}>{secondaryCandidates.reduce((s, c) => s + c.suggestedQty, 0)}</strong> standard parts.
            </span>
            <div style={{
          display: 'flex',
          gap: 8
        }}>
              <Btn variant="ghost" onClick={() => setShowSecondaryModal(false)}>Cancel</Btn>
              <Btn icon="brain" variant="success" onClick={handleGenerateSecondary} disabled={secondaryCandidates.reduce((s, c) => s + c.suggestedQty, 0) === 0}>Generate Secondary Nest</Btn>
            </div>
          </div>
        </Modal>}

      {showReport && <JobReportModal chosen={chosen} draft={draft} material={material} onClose={() => setShowReport(false)} />}
    </div>;
}

/* ════════════════════════════════════════
   JOB REPORT MODAL
════════════════════════════════════════ */