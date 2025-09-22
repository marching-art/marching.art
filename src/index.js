import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
'@ | Out-File -FilePath "src/index.js" -Encoding UTF8

# Create src/App.js
@'
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Ultimate Fantasy Drum Corps Game</h1>
        <p>Admin Account: o8vfRCOevjTKBY0k2dISlpiYiIH2</p>
        <p>Your app is ready!</p>
      </header>
    </div>
  );
}

export default App;
'@ | Out-File -FilePath "src/App.js" -Encoding UTF8

# Create src/index.css
@'
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background-color: #f5f5f5;
}

.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
'@ | Out-File -FilePath "src/index.css" -Encoding UTF8

# Create src/App.css
@'
.App {
  text-align: center;
}