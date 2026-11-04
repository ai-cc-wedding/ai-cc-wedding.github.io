/* Deployment settings. Edit these, not the page code. */
window.WEDDING_CONFIG = {
  // Public URL of the site (used for share links and og:url).
  siteUrl: 'https://ai-cc-wedding.github.io/',

  // Google Apps Script web app URL ending in /exec (see backend/README.md).
  // Empty = not connected: the public site refuses RSVPs, reviews and scores ("아직 접수 준비 중"), and only local
  // previews and ?demo keep them in the visitor's own browser. Local previews ignore this URL (shared/api.js).
  apiUrl: 'https://script.google.com/macros/s/AKfycbyzp6uNUzaJldaGpu7CrFRGVaHFfqldmlyc5qNv5ID4ooEUcUl6-w1QPEILRcBaMe-B/exec',

  // Optional Kakao JavaScript key for a native KakaoTalk share button.
  // Empty = the share button uses the phone's share sheet or copies the link.
  kakaoJsKey: '',
};
