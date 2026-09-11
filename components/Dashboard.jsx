import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ICONS, NAV, T, Icon, Btn, Card, Badge, Input, Select, Field, SectionHeader, EmptyState, Modal, StatCard, UtilArc } from './ui.jsx';
import { uid, fmt, fmtCurrency, parseCsvParts, blankDraft, SEED_MATERIALS, SEED_STANDARD_PARTS } from '../utils/helper.js';
import { downloadDxf, parseDxfDimensions } from '../utils/dxfExport.js';
import { runOptimization, runGeneticOptimizationAsync, packSecondaryParts, collectScrapCandidates, aiQualityScore, aiAutoSelectAlgorithm, breakdownBySize } from '../utils/nestingAlgorithm.js';
import { storeGet, storeSet, storeDelete, cloudSave, cloudLoad } from '../services/storage.js';

export default function Dashboard({
  jobsIndex,
  scrapInventory,
  materials,
  onGoto
}) {
  const completed = jobsIndex.filter(j => j.status === 'Completed');
  const avgUtil = completed.length ? completed.reduce((s, j) => s + j.utilization, 0) / completed.length : 0;
  const totalCost = completed.reduce((s, j) => s + j.cost, 0);
  const availScrap = scrapInventory.filter(s => s.status === 'Available');
  return <div className="slide-up">
      <SectionHeader eyebrow="Overview" title="Production Dashboard" action={<Btn icon="newjob" onClick={() => onGoto('newjob')}>New Job</Btn>} />
      <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
      gap: 12,
      marginBottom: 24
    }}>
        <StatCard label="Total Jobs" value={fmt(jobsIndex.length)} color={T.blue} icon="jobs" />
        <StatCard label="Avg Utilization" value={`${fmt(avgUtil, 1)}%`} color={T.green} icon="trend" sub={`${completed.length} completed jobs`} />
        <StatCard label="Total Material Cost" value={fmtCurrency(totalCost)} color={T.orange} icon="report" />
        <StatCard label="Scrap In Stock" value={fmt(availScrap.length)} color={T.purple} icon="scrap" sub="Ready to reuse" />
      </div>
      <Card>
        <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
          <span style={{
          fontFamily: T.fontDisplay,
          fontSize: 16,
          fontWeight: 700,
          color: T.text
        }}>Recent Jobs</span>
          <Btn size="sm" variant="ghost" onClick={() => onGoto('jobs')}>View all</Btn>
        </div>
        {jobsIndex.length === 0 ? <EmptyState title="No jobs yet" body="Create your first nesting job to see metrics here." action={<Btn icon="plus" onClick={() => onGoto('newjob')}>Create Job</Btn>} /> : jobsIndex.slice(0, 6).map(j => <div key={j.id} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: `1px solid ${T.border}`
      }}>
              <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${T.blue}18`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}><Icon d={ICONS.jobs} size={15} color={T.blue} /></div>
              <div style={{
          flex: 1,
          minWidth: 0
        }}>
                <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>{j.jobNo} · {j.project || 'Untitled'}</div>
                <div style={{
            fontSize: 12,
            color: T.textMuted
          }}>{j.materialName} · {j.sheetsUsed} sheet(s) · {fmt(j.utilization, 1)}%</div>
              </div>
              <span style={{
          fontFamily: T.fontMono,
          fontWeight: 700,
          color: T.green,
          fontSize: 13
        }}>{fmtCurrency(j.cost)}</span>
            </div>)}
      </Card>
    </div>;
}

/* ════════════════════════════════════════
   MATERIALS MASTER
════════════════════════════════════════ */