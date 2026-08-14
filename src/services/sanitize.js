import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p','strong','em','s','code','pre','blockquote','ul','ol','li','h1','h2','h3','br','a','hr','mark'];
const ALLOWED_ATTR = ['href','target','rel','data-comment-id'];

export function sanitizeHtml(dirty) {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS, ALLOWED_ATTR });
}
