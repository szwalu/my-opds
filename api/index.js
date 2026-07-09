const { createClient } = require("webdav");

module.exports = async function (req, res) {
  const url = process.env.WEBDAV_URL;
  const username = process.env.WEBDAV_USERNAME;
  const password = process.env.WEBDAV_PASSWORD;

  if (!url || !username || !password) {
    return res.status(500).send("请在 Vercel 中配置坚果云的环境变量");
  }

  const client = createClient(url, { username, password });
  
  try {
    // 读取坚果云的书籍目录
    const items = await client.getDirectoryContents("/");
    
    let entries = "";
    items.forEach(item => {
      // 过滤出 epub 和 pdf 文件
      if (item.type === "file" && (item.filename.endsWith(".epub") || item.filename.endsWith(".pdf"))) {
        
        // 自动把账号密码拼接到下载链接里，让 Readest 能直接无缝下载
        const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
        const hostPath = baseUrl.replace("https://", "").replace("http://", ""); 
        const downloadUrl = `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostPath}/${encodeURIComponent(item.basename)}`;
        const fileType = item.filename.endsWith(".epub") ? "application/epub+zip" : "application/pdf";

        entries += `
  <entry>
    <title>${item.basename}</title>
    <id>${item.filename}</id>
    <updated>${item.lastmod || new Date().toISOString()}</updated>
    <link rel="http://opds-spec.org/acquisition" href="${downloadUrl}" type="${fileType}"/>
  </entry>`;
      }
    });

    // 拼装符合 OPDS 协议的格式
    const opdsFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:webdav:opds:jianguoyun</id>
  <title>我的坚果云书库</title>
  <updated>${new Date().toISOString()}</updated>
  <link rel="self" href="https://${req.headers.host}/api/index" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="https://${req.headers.host}/api/index" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  ${entries}
</feed>`;

    // 返回书单数据给阅读软件
    res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8');
    res.status(200).send(opdsFeed);
  } catch (error) {
    console.error(error);
    res.status(500).send("连接坚果云失败: " + error.toString());
  }
}
