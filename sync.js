// sync.js
const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

async function getPosts() {
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
}

async function createMarkdownFiles(posts) {
  for (const post of posts) {
    const page = await notion.pages.retrieve({ page_id: post.id });
    const blocks = await notion.blocks.children.list({ block_id: post.id });
    
    let content = `---
title: "${page.properties.Title.title[0].plain_text}"
date: ${page.properties.Date.date.start}
tags: ${page.properties.Tags.multi_select.map(t => t.name).join(', ')}
categories: ${page.properties.Categories.multi_select.map(c => c.name).join(', ')}
---
`;

    for (const block of blocks.results) {
      if (block.type === 'paragraph') {
        content += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n\n';
      }
      // 添加其他块类型的处理...
    }

    const fileName = `${page.properties.Slug.rich_text[0].plain_text}.md`;
    const filePath = path.join(process.cwd(), 'source/_posts', fileName);
    
    fs.writeFileSync(filePath, content);
  }
}

(async () => {
  const posts = await getPosts();
  await createMarkdownFiles(posts);
})();