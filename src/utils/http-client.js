/**
 * @fileoverview A wrapper around Axios to handle HTTP requests to the target API.
 * Includes support for authentication, logging, and error handling.
 */

import axios from 'axios';

export class HttpClient {
  constructor() {
    this.client = null;
    this.config = {};
  }

  /**
   * Initialize the HTTP client
   */
  initialize(config) {
    this.config = config;
    
    this.client = axios.create({
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `${config.name || 'APIBridge'} v${config.version || '1.0.0'}`
      }
    });

    // Add API key if provided
    if (config.apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (request) => {
        if (config.enableLogging) {
          console.error(`[HTTP] ${request.method?.toUpperCase()} ${request.url}`);
        }
        return request;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        if (config.enableLogging) {
          console.error(`[HTTP] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        }
        return response;
      },
      (error) => {
        if (config.enableLogging) {
          const status = error.response?.status || 'ERR';
          const method = error.config?.method?.toUpperCase() || 'UNKNOWN';
          const url = error.config?.url || 'unknown';
          console.error(`[HTTP] ${status} ${method} ${url} - ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make an HTTP request
   */
  async request(method, url, data = null, options = {}) {
    if (!this.client) {
      throw new Error('HTTP client not initialized');
    }

    const config = {
      method: method.toLowerCase(),
      url,
      ...options
    };

    if (data && ['post', 'put', 'patch'].includes(config.method)) {
      config.data = data;
    }

    try {
      const response = await this.client.request(config);
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      };
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response received from server');
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(`Request failed: ${error.message}`);
      }
    }
  }

  /**
   * Make a GET request
   */
  async get(url, options = {}) {
    return this.request('GET', url, null, options);
  }

  /**
   * Make a POST request
   */
  async post(url, data, options = {}) {
    return this.request('POST', url, data, options);
  }

  /**
   * Make a PUT request
   */
  async put(url, data, options = {}) {
    return this.request('PUT', url, data, options);
  }

  /**
   * Make a PATCH request
   */
  async patch(url, data, options = {}) {
    return this.request('PATCH', url, data, options);
  }

  /**
   * Make a DELETE request
   */
  async delete(url, options = {}) {
    return this.request('DELETE', url, null, options);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.client) {
      // Update timeout
      if (newConfig.timeout) {
        this.client.defaults.timeout = newConfig.timeout;
      }

      // Update API key
      if (newConfig.apiKey) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${newConfig.apiKey}`;
      } else if (newConfig.apiKey === '') {
        delete this.client.defaults.headers.common['Authorization'];
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}
