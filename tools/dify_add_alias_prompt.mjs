// 在意图识别提示词里补上常见别称，让 LLM 也能把口语说法归一化
import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const appId = fs.readFileSync(`${OUT}/app-id.txt`, 'utf8').trim();

const ALIAS_LINE = `  常见别称（用户怎么说都要归一成上面的规范名）：一饭/一食堂=文采园（第一饭堂）；二饭/二食堂=博雅园（第二饭堂）；三饭/三食堂=风采园（第三饭堂）；校医院/医院=门诊部（校医院）；大礼堂/会堂=大会堂（教工活动中心）；羽球馆=体育馆（羽毛球馆）；主校门/大门=正门；教A~教G=教学楼A栋~教学楼G栋；实验楼C（不带区）=实验楼C区；只说"13栋"=南苑13栋、"3栋"=北苑3栋。`;

const { api, close } = await openDify(9395);
try {
  const draft = await api(`/console/api/apps/${appId}/workflows/draft`);
  const g = draft.body?.graph;
  let n = 0;
  for (const node of g.nodes) {
    const d = node.data || {};
    if (d.type === 'llm' && d.title === '意图识别') {
      const t = d.prompt_template[0].text;
      if (!t.includes('常见别称')) {
        d.prompt_template[0].text = t.replace(
          '  用户没说起点时 from 留空；',
          ALIAS_LINE + '\n  用户没说起点时 from 留空；'
        );
        n++;
      }
    }
  }
  console.log('router prompt updated:', n);
  const save = await api(`/console/api/apps/${appId}/workflows/draft`, {
    method: 'POST',
    body: { graph: g, features: draft.body.features, hash: draft.body.hash },
  });
  console.log('save', save.status, JSON.stringify(save.body).slice(0, 120));
  if (save.status === 200) {
    const pub = await api(`/console/api/apps/${appId}/workflows/publish`, {
      method: 'POST',
      body: { marked_name: '', marked_comment: '补充地点别称' },
    });
    console.log('publish', pub.status);
  }
} finally {
  await close();
}
