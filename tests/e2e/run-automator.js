/**
 * 微信开发者工具 UI 自动化入口（需 miniprogram-automator + 工具服务端口）
 *
 * 用法：
 *   npm install miniprogram-automator --save-dev
 *   打开微信开发者工具并开启服务端口
 *   npm run test:e2e
 */

const path = require('node:path')

const PROJECT_PATH = process.env.WECHAT_PROJECT_PATH || path.resolve(__dirname, '../..')

async function main() {
  let automator
  try {
    automator = require('miniprogram-automator')
  } catch {
    console.error(`
[跳过] 未安装 miniprogram-automator。

UI 自动化需要先安装依赖：
  npm install miniprogram-automator --save-dev

业务逻辑测试（无需开发者工具）：
  npm test
`)
    process.exit(1)
  }

  console.log('连接微信开发者工具…')
  console.log('项目路径:', PROJECT_PATH)

  const miniProgram = await automator.launch({
    projectPath: PROJECT_PATH
  })

  try {
    const page = await miniProgram.reLaunch('/pages/login/login')
    await page.waitFor(500)
    console.log('[OK] 已打开登录页 — 可在此脚本中继续补充 tap/switchTab 步骤')
  } finally {
    await miniProgram.close()
  }
}

main().catch((err) => {
  console.error('[失败]', err.message)
  console.error(`
请确认：
  1. 微信开发者工具已打开本项目
  2. 设置 → 安全设置 → 服务端口已开启
  3. project.config.json 路径正确
`)
  process.exit(1)
})
