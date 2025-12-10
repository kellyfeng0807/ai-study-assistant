/**
 * API 配置 - 自动环境检测

 */

// 检测当前环境
const currentHost = window.location.hostname;
const currentPort = window.location.port;

// 判断是否在 Render 生产环境
// Render 的特征：域名包含 onrender.com
const isRenderProduction = currentHost.includes('onrender.com');

// 判断是否在本地环境
const isLocalDevelopment = currentHost === 'localhost' || 
                          currentHost === '127.0.0.1' || 
                          currentHost.startsWith('192.168') ||
                          currentHost.startsWith('10.');


let API_BASE_URL;

if (isRenderProduction) {
    // Render 环境：前后端在同一域名，使用相对路径或当前域名
    API_BASE_URL = 'https://ai-study-assistant-2ozw.onrender.com';
} else if (isLocalDevelopment) {
    // 本地开发环境：连接本地后端
    API_BASE_URL = 'http://localhost:5000';
} else {
    // 其他情况（如 IP 访问）：尝试使用当前域名
    API_BASE_URL = window.location.origin;
}

// 输出当前配置（便于调试）
console.log('Environment Detection:');
console.log('- Host:', currentHost);
console.log('- Is Render:', isRenderProduction);
console.log('- Is Local:', isLocalDevelopment);
console.log('- API Base URL:', API_BASE_URL);

/**
 * 构建完整的 API URL
 * @param {string} endpoint - API 端点（如 '/api/note/list'）
 * @returns {string} 完整的 API URL
 */
export function getApiUrl(endpoint) {
    // 确保 endpoint 以 / 开头
    if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
    }
    return API_BASE_URL + endpoint;
}

/**
 * 带自动环境检测的 fetch 封装
 * @param {string} endpoint - API 端点
 * @param {object} options - fetch 选项
 * @returns {Promise<Response>}
 */
export async function apiFetch(endpoint, options = {}) {
    const url = getApiUrl(endpoint);
    
    // 设置默认 headers
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    
    const finalOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };
    
    try {
        console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);
        const response = await fetch(url, finalOptions);
        
        if (!response.ok) {
            console.warn(`⚠️  API Error: ${response.status} ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        console.error(`❌ API Request Failed (${endpoint}):`, error);
        throw error;
    }
}

/**
 * GET 请求封装
 */
export async function apiGet(endpoint) {
    const response = await apiFetch(endpoint, { method: 'GET' });
    return response.json();
}

/**
 * POST 请求封装
 */
export async function apiPost(endpoint, data) {
    const response = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return response.json();
}

/**
 * DELETE 请求封装
 */
export async function apiDelete(endpoint) {
    const response = await apiFetch(endpoint, { method: 'DELETE' });
    return response.json();
}

// 默认导出
export default {
    API_BASE_URL,
    getApiUrl,
    apiFetch,
    apiGet,
    apiPost,
    apiDelete,
    isRenderProduction,
    isLocalDevelopment
};

// 也作为全局变量暴露（兼容非模块脚本）
if (typeof window !== 'undefined') {
    window.AppConfig = {
        API_BASE_URL,
        getApiUrl,
        apiFetch,
        apiGet,
        apiPost,
        apiDelete
    };
}
