'use strict';

const https = require('https');

/**
 * CloudFront Lambda@Edge - Origin Request
 * 
 * MediaPackage Time-shift HLS 응답을 VOD 형식으로 변환합니다.
 * Origin Request에서 직접 MediaPackage로 요청하고 응답을 수정하여 반환합니다.
 * 
 * - EXT-X-PLAYLIST-TYPE을 EVENT에서 VOD로 변경
 * - #EXT-X-ENDLIST 태그 추가 (없는 경우)
 * 
 * 트리거: Origin Request
 * 조건: Time-shift 파라미터(start, end)가 있는 .m3u8 요청
 */

const ORIGIN_HOSTNAME = 'c4af3793bf76b33c.mediapackage.us-west-2.amazonaws.com';

/**
 * MediaPackage로 HTTPS 요청
 */
function fetchFromOrigin(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: ORIGIN_HOSTNAME,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'CloudFront-Lambda-Edge'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * HLS manifest를 VOD 형식으로 변환
 */
function convertToVod(body) {
  let modified = false;
  
  // 1. EXT-X-PLAYLIST-TYPE:EVENT를 VOD로 변경
  if (body.includes('#EXT-X-PLAYLIST-TYPE:EVENT')) {
    body = body.replace('#EXT-X-PLAYLIST-TYPE:EVENT', '#EXT-X-PLAYLIST-TYPE:VOD');
    modified = true;
  } else if (!body.includes('#EXT-X-PLAYLIST-TYPE:')) {
    body = body.replace('#EXTM3U', '#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD');
    modified = true;
  }
  
  // 2. #EXT-X-ENDLIST 태그 추가 (없는 경우)
  if (!body.includes('#EXT-X-ENDLIST')) {
    body = body.trimEnd() + '\n#EXT-X-ENDLIST\n';
    modified = true;
  }
  
  return { body, modified };
}

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const querystring = request.querystring || '';
  
  // Time-shift 파라미터 확인
  const hasTimeShift = querystring.includes('start=') && querystring.includes('end=');
  
  // .m3u8 파일이 아니거나 Time-shift 요청이 아니면 원본으로 전달
  if (!uri.endsWith('.m3u8') || !hasTimeShift) {
    return request;
  }
  
  try {
    // MediaPackage로 직접 요청
    const path = querystring ? `${uri}?${querystring}` : uri;
    const originResponse = await fetchFromOrigin(path);
    
    // 에러 응답이면 그대로 반환
    if (originResponse.status !== 200) {
      return {
        status: originResponse.status.toString(),
        statusDescription: 'Error',
        headers: {
          'content-type': [{ key: 'Content-Type', value: originResponse.headers['content-type'] || 'text/plain' }]
        },
        body: originResponse.body
      };
    }
    
    // HLS manifest가 아니면 원본 반환
    if (!originResponse.body.includes('#EXTM3U')) {
      return {
        status: '200',
        statusDescription: 'OK',
        headers: {
          'content-type': [{ key: 'Content-Type', value: originResponse.headers['content-type'] || 'application/vnd.apple.mpegurl' }]
        },
        body: originResponse.body
      };
    }
    
    // VOD 형식으로 변환
    const { body, modified } = convertToVod(originResponse.body);
    
    if (modified) {
      console.log(`Converted Time-shift HLS to VOD format: ${uri}`);
    }
    
    // 응답 반환 (content-length는 CloudFront가 자동 계산)
    return {
      status: '200',
      statusDescription: 'OK',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'application/vnd.apple.mpegurl' }],
        'cache-control': [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
        'access-control-allow-origin': [{ key: 'Access-Control-Allow-Origin', value: '*' }]
      },
      body: body
    };
    
  } catch (error) {
    console.error('Error fetching from origin:', error);
    
    // 에러 시 원본 요청으로 폴백
    return request;
  }
};
