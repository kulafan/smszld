const { Client } = require('@notionhq/client');

// 初始化客户端（必须添加版本）
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  // 关键修复：添加Notion版本
  notionVersion: '2022-06-28'
});

// 验证数据库ID格式
const databaseId = process.env.NOTION_DATABASE_ID;
if (!/^[a-f0-9]{32}$/.test(databaseId)) {
  throw new Error('Invalid Notion Database ID format');
}

async function getPosts() {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true,
        },
      },
    });
    return response.results;
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
}

// 其余代码保持不变...
