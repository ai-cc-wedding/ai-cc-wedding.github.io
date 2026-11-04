/* Single source of truth for every fact shown on the invitation.
   All versions read from window.WEDDING — fix a typo here and it is fixed everywhere. */
window.WEDDING = {
  groom: {
    name: '백진헌', first: '진헌', en: 'Jinheon Baek', enFirst: 'Jinheon',
    order: '장남', father: '백천석', mother: '정미란',
    homepage: 'https://jinheonbaek.github.io/',
  },
  bride: {
    name: '정소영', first: '소영', en: 'Soyeong Jeong', enFirst: 'Soyeong',
    order: '장녀', father: '정지원', mother: '윤정주',
    homepage: 'https://starsuzi.github.io/',
  },

  story: {
    metAt: '고려대학교 컴퓨터학과', metAtEn: 'Korea University, Computer Science',
    now: 'KAIST 김재철AI대학원', nowEn: 'KAIST Kim Jaechul Graduate School of AI',
  },

  date: {
    iso: '2026-12-19T18:00:00+09:00',
    ko: '2026년 12월 19일 토요일 오후 6시',
    koShort: '12월 19일 토요일 오후 6시',
    dot: '2026. 12. 19. Sat 6:00 PM',
    en: 'Saturday, December 19, 2026 · 6:00 PM',
    year: 2026, month: 12, day: 19, weekdayKo: '토요일', weekdayEn: 'Saturday',
    hour: 18, minute: 0,
  },

  venue: {
    name: '더그랜드롯데 서울',
    formerName: '롯데호텔 서울',
    // Both names on purpose: the hotel was renamed on 2026-08-14 and many guests still know the old name.
    display: '더그랜드롯데 서울 (구 롯데호텔 서울)',
    en: 'The Grand Lotte Seoul (formerly Lotte Hotel Seoul)',
    hall: '3층 사파이어볼룸',
    hallEn: 'Sapphire Ballroom, 3F',
    // The couple prefer the jibun address (소공동 1) as the main address shown to guests.
    // `address` is the fallback when addressJibun / addressRoad are missing (the road-name address).
    address: '서울특별시 중구 을지로 30',
    addressRoad: '서울특별시 중구 을지로 30',
    addressJibun: '서울특별시 중구 소공동 1',
    postal: '04533',
    tel: '02-771-1000',
    lat: 37.5653, lng: 126.9809778, // official pin (lottehotel.com)
  },

  directions: {
    subway: [
      '2호선 을지로입구역 7·8번 출구 방면 · 지하 통로로 호텔과 연결 (도보 약 2~3분)',
      '1·2호선 시청역 5·6번 출구 · 도보 약 7~10분',
    ],
    train: [
      'KTX 서울역 → 1호선 시청역(1정거장) 하차 후 도보',
      '서울역에서 택시 약 10~20분 (교통 상황에 따라 다름)',
    ],
    bus: [
      '롯데백화점 · 롯데영프라자 · 명동입구 · 명동 국민은행 앞 정류장 하차',
    ],
    car: [
      '내비게이션에 「더그랜드롯데 서울」 또는 「중구 소공동 1」 입력',
      '롯데백화점 본점과 주차장을 함께 사용합니다',
      '하객 주차 3시간 무료',
    ],
  },

  mapLinks: {
    // https links, not app schemes, so the KakaoTalk in-app browser can open them. On a phone, map.naver.com sends
    // Android to Naver's "install the app" page when Naver Map is missing, so phones get the mobile place page
    // (naverMobile), which shows the hotel either way.
    naver: 'https://map.naver.com/p/entry/place/11583194',
    naverMobile: 'https://m.place.naver.com/place/11583194/home',
    kakao: 'https://map.kakao.com/link/map/7855876',
    kakaoRoute: 'https://map.kakao.com/link/to/7855876',
    // TMAP has no public web link; app-only. Both parameter spellings seen in the wild are included.
    // Use Kit.openTmap() (mobile only, falls back to the store). Verify on a real phone before sending.
    tmap: 'tmap://route?goalname=%EB%8D%94%EA%B7%B8%EB%9E%9C%EB%93%9C%EB%A1%AF%EB%8D%B0%20%EC%84%9C%EC%9A%B8&goalx=126.9809778&goaly=37.5653' +
      '&rGoName=%EB%8D%94%EA%B7%B8%EB%9E%9C%EB%93%9C%EB%A1%AF%EB%8D%B0%20%EC%84%9C%EC%9A%B8&rGoX=126.9809778&rGoY=37.5653',
    tmapStore: {
      ios: 'https://apps.apple.com/kr/app/id431589174',
      android: 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku',
    },
    // The hotel's own Google Maps place (the canonical ?cid= link of the place the hotel's site links to): it opens
    // with the name, address and rating, where a coordinate search showed only an unnamed pin.
    google: 'https://maps.google.com/?cid=4276751823863535449',
    googleRoute: 'https://www.google.com/maps/dir/?api=1&destination=37.5653%2C126.9809778&travelmode=transit',
  },

  // Order follows the couple's list: parents first, then the groom/bride.
  accounts: {
    groom: [
      { role: '신랑 아버지', name: '백천석', bank: '하나은행', number: '717-910910-86807' },
      { role: '신랑 어머니', name: '정미란', bank: '하나은행', number: '717-910078-01407' },
      { role: '신랑', name: '백진헌', bank: '하나은행', number: '391-911050-09007' },
    ],
    bride: [
      { role: '신부 아버지', name: '정지원', bank: '하나은행', number: '752-910102-85107' },
      { role: '신부 어머니', name: '윤정주', bank: '하나은행', number: '448-910308-01807' },
      { role: '신부', name: '정소영', bank: '하나은행', number: '391-911052-20307' },
    ],
  },

  // A safe default greeting. Versions may rewrite it in their own voice.
  // The couple's own wording (2026-10-29). '' = paragraph break.
  greeting: [
    '고려대학교 컴퓨터학과에서 처음 만나',
    'KAIST에서 같은 꿈을 꾸며 걸어온 두 사람이',
    '이제 평생을 함께하려 합니다.',
    '',
    '귀한 걸음 하시어 저희의 새로운 시작을',
    '따뜻한 마음으로 축복해 주시면',
    '더없는 기쁨으로 간직하겠습니다.',
  ],

  giftNote: [
    '참석이 어려우신 분들을 위해 계좌번호를 기재하였습니다.',
    '너그러운 마음으로 양해 부탁드립니다.',
  ],

  // The reply date shows only in Important Dates (the RSVP form itself no longer repeats it).
  rsvp: {
    deadline: '2026-12-05',
  },

  // Prizes handed out on the wedding day; the game's ranking closes the night before (the end of 12/18), so the couple
  // know the winner before the day. Keep backend/Code.gs SETTINGS.CUTOFF in sync with gameCutoff.
  contest: {
    gameCutoff: '2026-12-19T00:00:00+09:00',
    gameCutoffText: '12월 18일(금)까지의 기록 기준 1위',
    gamePrize: '참석으로 회신해 주신 분 중 1등에게 결혼식 당일 작은 선물을 드려요.',
    reviewPrize: '정성 가득한 리뷰 중 Best Reviewer를 골라 결혼식 당일 선물을 드려요.',
  },

  // Background music (the ♪ buttons on the cover and in the bar; js/app.js). It starts by itself only where the browser
  // allows sound without a tap; elsewhere the ♪ buttons start it. It never starts by itself during the ceremony or for a
  // guest who turned it off. autoplay: false = only the buttons.
  // The track: "Wedding" by E-soundtrax (AudioJungle item 10001494), licensed for this website only, not for reuse or
  // redistribution.
  music: {
    src: 'assets/audio/bgm.mp3',
    title: 'Wedding', artist: 'E-soundtrax',
    autoplay: true,
  },
};

/* Convenience: text to copy for each account ("은행 계좌번호" is recognised by banking apps). */
(function (w) {
  ['groom', 'bride'].forEach(function (side) {
    w.accounts[side].forEach(function (a) { a.copy = a.bank + ' ' + a.number; });
  });
})(window.WEDDING);
