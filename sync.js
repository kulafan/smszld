const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { mkdirp } = require('mkdirp'); // 需要安装: npm install mkdirp

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
    for (const post of response.results) {
      try {
        const title = post.properties.Title?.title[0]?.plain_text || 'Untitled';
        const date = post.properties.Date?.date?.start || new Date().toISOString();
        
        // 提取Tags和Categories
        const tags = extractTags(post);
        const categories = extractCategories(post);
        
        // 生成文件名和目录名
        const safeTitle = title.toLowerCase().replace(/[^\w]/g, '-');
        const fileName = `${safeTitle}.md`;
        const postDirName = safeTitle; // 文章目录名与文件名相同
        const postDir = path.join('source/_posts', postDirName);
        const filePath = path.join('source/_posts', fileName);
        
        // 创建文章目录用于存放图片
        await mkdirp(postDir);

        // 获取文章内容
        const blocks = await notion.blocks.children.list({
          block_id: post.id
        });

        // 生成Markdown内容
        let content = `---
title: "${title}"
date: ${date}
tags: ${formatTagsOrCategories(tags)}
categories: ${formatTagsOrCategories(categories)}
---\n\n`;

        // 处理所有块
        for (const block of blocks.results) {
          if (block.type === 'paragraph') {
            content += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n\n';
          } else if (block.type === 'heading_1') {
            content += `# ${block.heading_1.rich_text.map(t => t.plain_text).join('')}\n\n`;
          } else if (block.type === 'heading_2') {
            content += `## ${block.heading_2.rich_text.map(t => t.plain_text).join('')}\n\n`;
          } else if (block.type === 'heading_3') {
            content += `### ${block.heading_3.rich_text.map(t => t.plain_text).join('')}\n\n`;
          } else if (block.type === 'bulleted_list_item') {
            content += `- ${block.bulleted_list_item.rich_text.map(t => t.plain_text).join('')}\n`;
          } else if (block.type === 'numbered_list_item') {
            content += `1. ${block.numbered_list_item.rich_text.map(t => t.plain_text).join('')}\n`;
          } else if (block.type === 'image') {
            // 处理图片
            const imageUrl = getImageUrl(block);
            if (imageUrl) {
              const imageName = await downloadImage(imageUrl, postDir);
              // 使用相对路径引用图片 (假设Hexo会正确处理这种引用)
              content += `![${imageName}](${imageName})\n\n`;
            }
          }
          // 可以添加更多块类型的处理
        }

        // 写入Markdown文件
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

// 获取图片URL
function getImageUrl(block) {
  if (!block.image) return null;
  
  // 处理不同来源的图片
  if (block.image.type === 'external') {
    return block.image.external.url;
  } else if (block.image.type === 'file') {
    return block.image.file.url;
  }
  
  return null;
}

// 下载图片到指定目录
async function downloadImage(url, dir) {
  return new Promise((resolve, reject) => {
    // 生成唯一文件名
    const ext = path.extname(url).split('?')[0] || '.jpg';
    const fileName = `image-${Date.now()}${ext}`;
    const filePath = path.join(dir, fileName);
    
    const file = fs.createWriteStream(filePath);
    
    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载图片失败，状态码: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(fileName);
      });
    }).on('error', error => {
      fs.unlink(filePath, () => {}); // 删除可能已创建的损坏文件
      reject(error);
    });
  });
}

// 提取Tags的辅助函数
function extractTags(post) {
  const tagProperty = post.properties.Tags;
  if (!tagProperty || tagProperty.type !== 'multi_select') {
    return [];
  }
  return tagProperty.multi_select.map(option => option.name);
}

// 提取Categories的辅助函数
function extractCategories(post) {
  const categoryProperty = post.properties.Categories;
  if (!categoryProperty || categoryProperty.type !== 'select') {
    return [];
  }
  return categoryProperty.select ? [categoryProperty.select.name] : [];
}

// 格式化Tags或Categories为YAML数组格式
function formatTagsOrCategories(items) {
  if (!items || items.length === 0) {
    return '[]';
  }
  if (items.length === 1) {
    return `[${items[0]}]`;
  }
  return '[' + items.map(item => `"${item}"`).join(', ') + ']';
}

// 执行同步
syncNotionToHexo();