const AD_KEYS = {
  '300x250': 'd5470d15981d62ce4586cbb96f11ed01',
  '728x90': 'd5470d15981d62ce4586cbb96f11ed01',
  '320x50': 'd5470d15981d62ce4586cbb96f11ed01',
};

export const buildAdHtml = (width, height) => {
  const key = AD_KEYS[`${width}x${height}`] || AD_KEYS['300x250'];
  const scriptSrc = `https://bauval.org/22/${key}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:flex;justify-content:center;align-items:center}</style></head><body><script type="text/javascript">atOptions={'key':'${key}','format':'iframe','height':${height},'width':${width},'params':{}};</script><script type="text/javascript" src="${scriptSrc}"></script></body></html>`;
};
