import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.BASE_URL + 'api',
  headers: { 'Content-Type': 'application/json' },
})

export default client
