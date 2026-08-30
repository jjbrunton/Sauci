/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        // No file extension by design; iOS requires this exact path and
        // rejects a response that isn't served as application/json.
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
