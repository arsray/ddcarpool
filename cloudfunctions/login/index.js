/**
 * M1 — login 云函数
 * 返回当前用户的 openid
 * 部署：微信开发者工具 → 右键本目录 → 上传并部署：云端安装依赖
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID
  }
}
