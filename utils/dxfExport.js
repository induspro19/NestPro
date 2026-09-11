
export function parseDxfDimensions(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new window.DxfParser();
        const dxf = parser.parseSync(e.target.result);
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        let hasEntities = false;
        const updateBounds = (x, y) => {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        };
        const processEntity = ent => {
          if (ent.type === 'LINE') {
            updateBounds(ent.vertices[0].x, ent.vertices[0].y);
            updateBounds(ent.vertices[1].x, ent.vertices[1].y);
            hasEntities = true;
          } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
            const r = ent.radius;
            updateBounds(ent.center.x - r, ent.center.y - r);
            updateBounds(ent.center.x + r, ent.center.y + r);
            hasEntities = true;
          } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
            ent.vertices.forEach(v => updateBounds(v.x, v.y));
            hasEntities = true;
          } else if (ent.type === 'INSERT') {
            updateBounds(ent.position.x, ent.position.y);
          }
        };
        dxf.entities.forEach(processEntity);
        if (!hasEntities) throw new Error("No usable geometry found in DXF");
        const length = Math.ceil(maxX - minX);
        const width = Math.ceil(maxY - minY);
        resolve({
          length,
          width
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/* ─── DXF Export (preserved) ─── */
export function dxfN(n) {
  const v = Math.round((n + Number.EPSILON) * 1000) / 1000;
  return (Object.is(v, -0) ? 0 : v).toString();
}
export function dxfLine(x1, y1, x2, y2, layer) {
  return `0\nLINE\n8\n${layer}\n10\n${dxfN(x1)}\n20\n${dxfN(y1)}\n30\n0\n11\n${dxfN(x2)}\n21\n${dxfN(y2)}\n31\n0\n`;
}
export function dxfRect(x, y, w, h, layer) {
  return dxfLine(x, y, x + w, y, layer) + dxfLine(x + w, y, x + w, y + h, layer) + dxfLine(x + w, y + h, x, y + h, layer) + dxfLine(x, y + h, x, y, layer);
}
export function dxfText(x, y, height, value, layer) {
  return `0\nTEXT\n8\n${layer}\n10\n${dxfN(x)}\n20\n${dxfN(y)}\n30\n0\n40\n${dxfN(Math.max(height, 0.1))}\n1\n${String(value).replace(/[\r\n]+/g, ' ')}\n`;
}
export const DXF_LAYERS = [{
  name: 'SHEET_OUTLINE',
  color: 7
}, {
  name: 'PARTS',
  color: 5
}, {
  name: 'PART_LABELS',
  color: 3
}, {
  name: 'SECONDARY_PARTS',
  color: 3
}, {
  name: 'LABELS',
  color: 1
}];
export function buildDxfForOption(option, material, jobNo) {
  let entities = '';
  const thickness = material?.thickness || '';
  const sheets = option.sheets || [];
  const maxDim = sheets.reduce((m, sh) => Math.max(m, sh.usableW, sh.usableH), 100),
    sheetGap = Math.max(maxDim * 0.06, 100);
  let offsetX = 0;
  sheets.forEach((sheet, sIdx) => {
    const sw = sheet.usableW,
      sh = sheet.usableH,
      labelH = Math.max(maxDim * 0.022, 20);
    entities += dxfRect(offsetX, 0, sw, sh, 'SHEET_OUTLINE');
    entities += dxfText(offsetX, sh + labelH * 1.4, labelH, `SHEET ${sIdx + 1} OF ${sheets.length}${jobNo ? ' ' + jobNo : ''}${sheet.source === 'scrap' ? ' — REUSED SCRAP' : ''}`, 'LABELS');
    if (thickness) entities += dxfText(offsetX, sh + labelH * 0.2, labelH, `THICKNESS: ${thickness} MM`, 'LABELS');
    (sheet.placements || []).forEach(p => {
      entities += dxfRect(offsetX + p.x, p.y, p.w, p.h, p.isSecondary ? 'SECONDARY_PARTS' : 'PARTS');
      const th = Math.max(Math.min(p.w, p.h) * 0.16, labelH * 0.5);
      entities += dxfText(offsetX + p.x + Math.min(p.w, p.h) * 0.08, p.y + p.h / 2 - th / 2, th, `${p.partNo}${p.rotated ? ' R' : ''}`, 'PART_LABELS');
    });
    offsetX += sw + sheetGap;
  });
  const layerDefs = DXF_LAYERS.map(l => `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`).join('');
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${DXF_LAYERS.length}\n${layerDefs}0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n` + entities + `0\nENDSEC\n0\nEOF\n`;
}
export function downloadDxf(option, material, jobNo) {
  const content = buildDxfForOption(option, material, jobNo),
    blob = new Blob([content], {
      type: 'application/dxf'
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `${(jobNo || 'JOB').replace(/[^\w-]+/g, '')}_${(option.sizeLabel || 'layout').replace(/[^\w]+/g, '')}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── CSV parsing (preserved) ─── */
