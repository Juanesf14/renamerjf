import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
})

// Attach the JWT from localStorage to every outgoing request.
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear credentials and force a full reload to show the login screen.
// This handles both expired tokens and revoked sessions without needing a router.
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export default api