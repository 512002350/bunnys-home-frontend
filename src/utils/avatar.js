/**
 * 头像工具函数 — 从字符 ID/名称生成一致的颜色和首字符
 * 所有组件共用，避免复制粘贴
 */

/**
 * 根据字符串生成一致的哈希颜色
 */
export function avatarColor(str) {
  const colors = [
    '#FF6B6B', '#FF8E53', '#FFC048', '#4ECDC4',
    '#45B7D1', '#96CEB4', '#6C5CE7', '#A29BFE',
    '#FD79A8', '#FDCB6E', '#00B894', '#00CEC9',
    '#E17055', '#D63031', '#0984E3', '#6C5CE7',
    '#E84393', '#00B894', '#FDCB6E', '#636E72',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * 获取字符串的首字符（中文优先取首个汉字，英文取首字母大写）
 */
export function getInitial(str) {
  if (!str) return '?';
  const chineseMatch = str.match(/[一-鿿]/);
  if (chineseMatch) return chineseMatch[0];
  return str.charAt(0).toUpperCase();
}
