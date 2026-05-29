// CloudFront Function: viewer-response
// Injects CORS headers into ALL responses (including OPTIONS) from API Gateway origin.
// API Gateway's native CORS handles preflight at the OPTIONS method level.
// This function ensures CORS headers are present for browser requests.
function handler(event) {
  var response = event.response;
  var request = event.request;

  // Inject CORS headers into response
  response.headers['access-control-allow-origin'] = { value: '*' };
  response.headers['access-control-allow-methods'] = { value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
  response.headers['access-control-allow-headers'] = { 
    value: 'Content-Type,Authorization,Origin,X-Requested-With,Accept' 
  };
  response.headers['access-control-max-age'] = { value: '86400' };

  // For OPTIONS (preflight), return 204 with no body
  if (request.method === 'OPTIONS') {
    return {
      statusCode: 204,
      statusDescription: 'No Content',
      headers: response.headers,
      body: ''
    };
  }

  return response;
}
