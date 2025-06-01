const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

(async () => {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true
        }
      }
    });

    console.log("查询到文章数量：", response.results.length);
    response.results.forEach(page => {
      const title = page.properties?.Title?.title?.[0]?.plain_text || 'Untitled';
      console.log("文章标题：", title);
    });
  } catch (error) {
    console.error("❌ 查询失败：", error.message);
  }
})();
