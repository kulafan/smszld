const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2022-06-28'
});

async function syncNotionToHexo() {
  try {
    // 1. 获取文章列表
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true
        }
      }
    });

    // 2. 确保获取到数据
    if (!response.results || response.results.length === 0) {
      console.log('没有找到已发布的文章');
      return;
    }

    // 3. 处理每篇文章
    for (const post of response.results) {  // 这里正确定义post
      try {
        const title = post.properties.Title?.title[0]?.plain_text || 'Untitled';
        const date = post.properties.Date?.date?.start || new Date().toISOString();
        
        // 生成文件名
        const fileName = `${title.toLowerCase().replace(/[^\w]/g, '-')}.md`;
        const filePath = path.join('source/_posts', fileName);

        // 获取文章内容
        const blocks = await notion.blocks.children.list({
          block_id: post.id
        });

        // 生成Markdown内容
        let content = `---
title: "${title}"
date: ${date}
---\n\n`;

        blocks.results.forEach(block => {
          if (block.type === 'paragraph') {
            content += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n\n';
          }
          // 可以添加其他block类型的处理
        });

        // 写入文件
        fs.writeFileSync(filePath, content);
        console.log(`成功生成: ${fileName}`);
        
      } catch (error) {
        console.error(`处理文章时出错: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`同步失败: ${error.message}`);
    process.exit(1);
  }
}

// 执行同步
syncNotionToHexo();