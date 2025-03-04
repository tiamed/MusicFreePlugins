import axios from "axios";
import dayjs = require("dayjs");
import he = require("he");

const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63",
  accept: "*/*",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
};
let cookie;

/** 获取cid */
async function getCid(bvid, aid) {
  const params = bvid
    ? {
      bvid: bvid,
    }
    : {
      aid: aid,
    };
  const cidRes = (
    await axios.get("https://api.bilibili.com/x/web-interface/view?%s", {
      headers: headers,
      params: params,
    })
  ).data;
  return cidRes;
}

/** 格式化 */
function durationToSec(duration: string | number) {
  if (typeof duration === "number") {
    return duration;
  }

  if (typeof duration === "string") {
    var dur = duration.split(":");
    return dur.reduce(function (prev, curr) {
      return 60 * prev + +curr;
    }, 0);
  }

  return 0;
}

const searchHeaders = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63",
  accept: "application/json, text/plain, */*",
  "accept-encoding": "gzip, deflate, br",
  origin: "https://search.bilibili.com",
  "sec-fetch-site": "same-site",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
  referer: "https://search.bilibili.com/",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
};
async function getCookie() {
  if (!cookie) {
    cookie = await axios.get("https://api.bilibili.com/x/frontend/finger/spi", {
      headers: searchHeaders,
    });
  }
}
const pageSize = 30;
/** 搜索 */
async function searchBase(keyword: string, page: number, searchType) {
  await getCookie();
  const params = {
    context: "",
    page: page,
    order: "",
    page_size: pageSize,
    keyword: keyword,
    duration: "",
    tids_1: "",
    tids_2: "",
    __refresh__: true,
    _extra: "",
    highlight: 1,
    single_column: 0,
    platform: "pc",
    from_source: "",
    search_type: searchType,
    dynamic_offset: 0,
  };
  const res = (
    await axios.get("https://api.bilibili.com/x/web-interface/search/type", {
      headers: {
        ...searchHeaders,
        cookie: `buvid3=${cookie.b_3};buvid4=${cookie.b_4}`,
      },
      params: params,
    })
  ).data;
  return res.data;
}

/** 获取收藏夹 */
async function getFavoriteList(id: number | string) {
  const result = [];
  const pageSize = 20;
  let page = 1;

  while (true) {
    try {
      const { data: { data: { medias, has_more } } } = await axios.get(
        'https://api.bilibili.com/x/v3/fav/resource/list', {
        params: {
          media_id: id,
          platform: 'web',
          ps: pageSize,
          pn: page,
        },
      },
      );
      result.push(...medias);

      if (!has_more) {
        break;
      }
      page += 1;
    } catch (error) {
      console.warn(error);
      break;
    }
  }

  return result;
}


function formatMedia(result: any) {
  return {
    id: result.cid ?? result.bvid ?? result.aid,
    aid: result.aid,
    bvid: result.bvid,
    artist: result.author ?? result.owner?.name,
    title: he.decode(
      result.title?.replace(/(\<em(.*?)\>)|(\<\/em\>)/g, "") ?? ""
    ),
    album: result.bvid ?? result.aid,
    artwork: result.pic?.startsWith("//")
      ? "http:".concat(result.pic)
      : result.pic,
    description: result.description,
    duration: durationToSec(result.duration),
    tags: result.tag?.split(","),
    date: dayjs.unix(result.pubdate || result.created).format("YYYY-MM-DD"),
  };
}

async function searchAlbum(keyword, page) {
  const resultData = await searchBase(keyword, page, "video");
  const albums = resultData.result.map(formatMedia);
  return {
    isEnd: resultData.numResults <= page * pageSize,
    data: albums,
  };
}

async function searchArtist(keyword, page) {
  const resultData = await searchBase(keyword, page, "bili_user");
  const artists = resultData.result.map((result) => ({
    name: result.uname,
    id: result.mid,
    fans: result.fans,
    description: result.usign,
    avatar: result.upic,
    worksNum: result.videos,
  }));
  return {
    isEnd: resultData.numResults <= page * pageSize,
    data: artists,
  };
}

async function getArtistWorks(artistItem, page, type) {
  const queryHeaders = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63",
    accept: "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    origin: "https://space.bilibili.com",
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    referer: `https://space.bilibili.com/${artistItem.id}/video`,
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
  };

  await getCookie();
  const params = {
    mid: artistItem.id,
    ps: 30,
    tid: 0,
    pn: page,
    order: "pubdate",
    jsonp: "jsonp",
  };
  const res = (
    await axios.get("https://api.bilibili.com/x/space/arc/search", {
      headers: {
        ...queryHeaders,
        cookie: `buvid3=${cookie.b_3};buvid4=${cookie.b_4}`,
      },
      params: params,
    })
  ).data;
  const resultData = res.data;
  const albums = resultData.list.vlist.map(formatMedia);

  return {
    isEnd: resultData.page.pn * resultData.page.ps >= resultData.page.count,
    data: albums,
  };
}

/** 获取音源 */
async function getMediaSource(
  musicItem: IMusic.IMusicItem,
  quality: IMusic.IQualityKey
) {
  let cid = musicItem.cid;

  if (!cid) {
    cid = (await getCid(musicItem.bvid, musicItem.aid)).data.cid;
  }

  const _params = musicItem.bvid
    ? {
      bvid: musicItem.bvid,
    }
    : {
      aid: musicItem.aid,
    };

  const res = (
    await axios.get("https://api.bilibili.com/x/player/playurl", {
      headers: headers,
      params: { ..._params, cid: cid, fnval: 16 },
    })
  ).data;
  let url;

  if (res.data.dash) {
    const audios = res.data.dash.audio;
    audios.sort((a, b) => a.bandwidth - b.bandwidth);
    switch (quality) {
      case "low":
        url = audios[0].baseUrl;
        break;
      case "standard":
        url = audios[1].baseUrl;
        break;
      case "high":
        url = audios[2].baseUrl;
        break;
      case "super":
        url = audios[3].baseUrl;
        break;
    }
  } else {
    url = res.data.durl[0].url;
  }

  const hostUrl = url.substring(url.indexOf("/") + 2);
  const _headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 Edg/89.0.774.63",
    accept: "*/*",
    host: hostUrl.substring(0, hostUrl.indexOf("/")),
    "accept-encoding": "gzip, deflate, br",
    connection: "keep-alive",
    referer: "https://www.bilibili.com/video/".concat(
      (musicItem.bvid !== null && musicItem.bvid !== undefined
        ? musicItem.bvid
        : musicItem.aid) ?? ""
    ),
  };
  return {
    url: url,
    headers: _headers,
  };
}

async function getTopLists() {
  // 入站必刷
  const precious = {
    title: "入站必刷",
    data: [
      {
        id: "popular/precious?page_size=100&page=1",
        title: "入站必刷",
        coverImg:
          "https://s1.hdslb.com/bfs/static/jinkela/popular/assets/icon_history.png",
      },
    ],
  };

  // 每周必看
  const weekly = {
    title: "每周必看",
    data: [],
  };
  const weeklyRes = await axios.get(
    "https://api.bilibili.com/x/web-interface/popular/series/list",
    {
      headers: {
        ...headers,
        referer: "https://www.bilibili.com/",
      },
    }
  );
  weekly.data = weeklyRes.data.data.list.slice(0, 8).map((e) => ({
    id: `popular/series/one?number=${e.number}`,
    title: e.subject,
    description: e.name,
    coverImg:
      "https://s1.hdslb.com/bfs/static/jinkela/popular/assets/icon_weekly.png",
  }));

  // 排行榜

  const boardKeys = [
    {
      id: "ranking/v2?rid=0&type=all",
      title: "全站",
    },
    {
      id: "ranking/v2?rid=3&type=all",
      title: "音乐",
    },
    {
      id: "ranking/v2?rid=1&type=all",
      title: "动画",
    },
    {
      id: "ranking/v2?rid=119&type=all",
      title: "鬼畜",
    },
    {
      id: "ranking/v2?rid=168&type=all",
      title: "国创相关",
    },
    {
      id: "ranking/v2?rid=129&type=all",
      title: "舞蹈",
    },
    {
      id: "ranking/v2?rid=4&type=all",
      title: "游戏",
    },
    {
      id: "ranking/v2?rid=36&type=all",
      title: "知识",
    },
    {
      id: "ranking/v2?rid=188&type=all",
      title: "科技",
    },
    {
      id: "ranking/v2?rid=234&type=all",
      title: "运动",
    },
    {
      id: "ranking/v2?rid=223&type=all",
      title: "汽车",
    },
    {
      id: "ranking/v2?rid=160&type=all",
      title: "生活",
    },
    {
      id: "ranking/v2?rid=211&type=all",
      title: "美食",
    },
    {
      id: "ranking/v2?rid=217&type=all",
      title: "动物圈",
    },
    {
      id: "ranking/v2?rid=115&type=all",
      title: "时尚",
    },
    {
      id: "ranking/v2?rid=5&type=all",
      title: "娱乐",
    },
    {
      id: "ranking/v2?rid=181&type=all",
      title: "影视",
    },
    {
      id: "ranking/v2?rid=0&type=origin",
      title: "原创",
    },
    {
      id: "ranking/v2?rid=0&type=rookie",
      title: "新人",
    },
  ];
  const board = {
    title: "排行榜",
    data: boardKeys.map((_) => ({
      ..._,
      coverImg:
        "https://s1.hdslb.com/bfs/static/jinkela/popular/assets/icon_rank.png",
    })),
  };
  return [weekly, precious, board];
}

async function getTopListDetail(topListItem: IMusicSheet.IMusicSheetItem) {
  const res = await axios.get(
    `https://api.bilibili.com/x/web-interface/${topListItem.id}`,
    {
      headers: {
        ...headers,
        referer: "https://www.bilibili.com/",
      },
    }
  );
  return {
    ...topListItem,
    musicList: res.data.data.list.map(formatMedia),
  };
}

async function importMusicSheet(urlLike: string) {
  let id: string;
  if (!id) {
    id = urlLike.match(/^\s*(\d+)\s*$/)?.[1];
  }
  if (!id) {
    id = urlLike.match(/^(?:.*)fid=(\d+).*$/)?.[1];
  }
  if (!id) {
    id = urlLike.match(/\/playlist\/pl(\d+)/i)?.[1];
  }
  if (!id) {
    id = urlLike.match(/\/list\/ml(\d+)/i)?.[1];
  }
  if (!id) {
    return;
  }
  const musicSheet = await getFavoriteList(id);
  return musicSheet.map(_ => ({
    id: _.id,
    aid: _.aid,
    bvid: _.bvid,
    artwork: _.cover,
    title: _.title,
    artist: _.upper?.name,
    album: _.bvid ?? _.aid,
    duration: durationToSec(_.duration),
  }))
}

module.exports = {
  platform: "bilibili",
  appVersion: ">=0.0",
  version: "0.1.2",
  defaultSearchType: "album",
  cacheControl: "no-cache",
  srcUrl: "https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/bilibili/index.js",
  primaryKey: ["id", "aid", "bvid", "cid"],
  hints: {
    importMusicSheet: [
        // 'bilibili 移动端：APP点击我的，空间，右上角分享，复制链接，浏览器打开切换桌面版网站，点击播放全部视频，复制链接',
        'bilibili H5/PC端：复制收藏夹URL，或者直接输入ID即可',
        '非公开收藏夹无法导入，编辑收藏夹改为公开即可',
        '导入时间和歌单大小有关，请耐心等待'
    ]
},
  async search(keyword, page, type) {
    if (type === "album" || type === "music") {
      return await searchAlbum(keyword, page);
    }
    if (type === "artist") {
      return await searchArtist(keyword, page);
    }
  },

  getMediaSource,
  async getAlbumInfo(albumItem) {
    const cidRes = await getCid(albumItem.bvid, albumItem.aid);

    const _ref2 = cidRes?.data ?? {};
    const cid = _ref2.cid;
    const pages = _ref2.pages;

    let musicList;
    if (pages.length === 1) {
      musicList = [{ ...albumItem, cid: cid }];
    } else {
      musicList = pages.map(function (_) {
        return {
          ...albumItem,
          cid: _.cid,
          title: _.part,
          duration: durationToSec(_.duration),
          id: _.cid,
        };
      });
    }
    return {
      musicList,
    };
  },

  getArtistWorks,
  getTopLists,
  getTopListDetail,
  importMusicSheet,
};
