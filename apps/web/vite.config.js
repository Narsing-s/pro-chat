import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  base:'/pro-chat/',
  server:{
    host:'0.0.0.0',
    port:5173,
    strictPort:true,
    proxy:{
      '/api':{
        target:'http://127.0.0.1:3000',
        changeOrigin:true,
        secure:false
      },
      '/socket.io':{
        target:'http://127.0.0.1:3000',
        changeOrigin:true,
        ws:true,
        secure:false
      },
      '/realtime-socket.io':{
        target:'http://127.0.0.1:3001',
        changeOrigin:true,
        ws:true,
        secure:false,
        rewrite:(path)=>path.replace(/^\/realtime-socket\.io/,'/socket.io')
      }
    }
  }
});
