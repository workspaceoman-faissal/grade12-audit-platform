export default async function handler(req, res) {
  // قراءة متغيرات البيئة من Vercel
  const TOKEN = process.env.GITHUB_TOKEN;
  const USERNAME = process.env.GITHUB_USERNAME;
  const REPO = process.env.GITHUB_REPO;
  const BRANCH = process.env.GITHUB_BRANCH || 'main';

  // التأكد من ضبط البيئة
  if (!TOKEN || !USERNAME || !REPO) {
    return res.status(500).json({ 
      error: 'خطأ: لم يتم ضبط متغيرات البيئة (GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_REPO) في Vercel.' 
    });
  }

  // 1. طلب (GET): قراءة قاعدة البيانات data.json من المستودع
  if (req.method === 'GET') {
    try {
      const url = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}/data.json?nocache=${Date.now()}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `token ${TOKEN}` }
      });

      if (!response.ok) {
        throw new Error('تعذر جلب البيانات من المستودع');
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. طلب (POST): حفظ البيانات أو رفع الملفات والمرفقات لـ GitHub
  if (req.method === 'POST') {
    try {
      const { path, content, message } = req.body;

      if (!path || !content) {
        return res.status(400).json({ error: 'البيانات المرسلة غير مكتملة' });
      }

      const getUrl = `https://api.github.com/repos/${USERNAME}/${REPO}/contents/${path}`;
      
      // جلب ملف SHA في حال كان الملف موجوداً مسبقاً لاستبداله
      const getRes = await fetch(getUrl, {
        headers: { 
          'Authorization': `token ${TOKEN}`,
          'User-Agent': 'Vercel-Serverless-App'
        }
      });

      let sha = undefined;
      if (getRes.ok) {
        const existingFile = await getRes.json();
        sha = existingFile.sha;
      }

      // إرسال الملف والتحديث بـ GitHub API
      const putRes = await fetch(getUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Serverless-App'
        },
        body: JSON.stringify({
          message: message || `Update ${path} via Vercel Platform`,
          content: content,
          sha: sha,
          branch: BRANCH
        })
      });

      if (!putRes.ok) {
        const errorData = await putRes.json();
        return res.status(putRes.status).json({ error: 'فشل التحديث على GitHub', details: errorData });
      }

      const result = await putRes.json();
      const rawFileUrl = `https://raw.githubusercontent.com/${USERNAME}/${REPO}/${BRANCH}/${path}`;
      
      return res.status(200).json({ 
        success: true, 
        fileUrl: rawFileUrl,
        githubResponse: result 
      });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
