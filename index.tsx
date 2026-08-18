
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppChat from './AppChat';

// ?chat=1 active la variante « panneau conversation façon ChatGPT/Claude ».
const useChat = new URLSearchParams(window.location.search).get('chat') === '1';
const Root = useChat ? AppChat : App;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("L'élément racine est introuvable pour le montage");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <>
    <Root />
  </>
);
