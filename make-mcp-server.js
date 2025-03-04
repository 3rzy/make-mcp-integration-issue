const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');

// Załaduj zmienne środowiskowe
dotenv.config();

// Konfiguracja
const config = {
  make: {
    apiToken: process.env.MAKE_API_TOKEN,
    baseUrl: 'https://eu1.make.com/api/v2' // Może się różnić w zależności od regionu
  },
  port: process.env.PORT || 3001
};

// Inicjalizacja serwera Express
const app = express();
app.use(express.json());
const server = http.createServer(app);

// Inicjalizacja serwera WebSocket
const wss = new WebSocket.Server({ server });

// Funkcje pomocnicze dla API Make
const makeApi = {
  // Autentykacja dla każdego zapytania
  getHeaders: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Token ${config.make.apiToken}`
  }),

  // Pobierz listę scenariuszy
  getScenarios: async () => {
    try {
      const response = await axios.get(`${config.make.baseUrl}/scenarios`, {
        headers: makeApi.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Błąd podczas pobierania scenariuszy:', error.message);
      throw new Error(`Nie udało się pobrać scenariuszy: ${error.message}`);
    }
  },

  // Pobierz szczegóły scenariusza
  getScenario: async (scenarioId) => {
    try {
      const response = await axios.get(`${config.make.baseUrl}/scenarios/${scenarioId}`, {
        headers: makeApi.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Błąd podczas pobierania scenariusza ${scenarioId}:`, error.message);
      throw new Error(`Nie udało się pobrać scenariusza: ${error.message}`);
    }
  },

  // Uruchom scenariusz
  runScenario: async (scenarioId) => {
    try {
      const response = await axios.post(`${config.make.baseUrl}/scenarios/${scenarioId}/run`, {}, {
        headers: makeApi.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Błąd podczas uruchamiania scenariusza ${scenarioId}:`, error.message);
      throw new Error(`Nie udało się uruchomić scenariusza: ${error.message}`);
    }
  },

  // Włącz/wyłącz scenariusz
  toggleScenario: async (scenarioId, active) => {
    try {
      const response = await axios.patch(`${config.make.baseUrl}/scenarios/${scenarioId}`, {
        active
      }, {
        headers: makeApi.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Błąd podczas przełączania stanu scenariusza ${scenarioId}:`, error.message);
      throw new Error(`Nie udało się przełączyć stanu scenariusza: ${error.message}`);
    }
  },

  // Utwórz nowy scenariusz
  createScenario: async (name, folderID = null) => {
    try {
      const payload = {
        name,
        ...(folderID && { folderID })
      };
      
      const response = await axios.post(`${config.make.baseUrl}/scenarios`, payload, {
        headers: makeApi.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Błąd podczas tworzenia scenariusza:', error.message);
      throw new Error(`Nie udało się utworzyć scenariusza: ${error.message}`);
    }
  },

  // Pobierz dostępne aplikacje
  getApps: async () => {
    try {
      const response = await axios.get(`${config.make.baseUrl}/apps`, {
        headers: makeApi.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Błąd podczas pobierania aplikacji:', error.message);
      throw new Error(`Nie udało się pobrać dostępnych aplikacji: ${error.message}`);
    }
  },

  // Pobierz historię uruchomień scenariusza
  getScenarioHistory: async (scenarioId, limit = 10) => {
    try {
      const response = await axios.get(`${config.make.baseUrl}/scenarios/${scenarioId}/history`, {
        params: { limit },
        headers: makeApi.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Błąd podczas pobierania historii scenariusza ${scenarioId}:`, error.message);
      throw new Error(`Nie udało się pobrać historii scenariusza: ${error.message}`);
    }
  }
};

// Lista narzędzi MCP
const tools = [
  {
    name: "list_scenarios",
    description: "Pobiera listę wszystkich scenariuszy w Make",
    handler: async () => {
      const scenarios = await makeApi.getScenarios();
      return { scenarios };
    }
  },
  {
    name: "run_scenario",
    description: "Uruchamia scenariusz w Make",
    handler: async (params) => {
      const { scenarioId } = params;
      if (!scenarioId) {
        throw new Error("Brak wymaganego parametru 'scenarioId'");
      }
      const result = await makeApi.runScenario(scenarioId);
      return { 
        success: true,
        executionId: result.executionId,
        message: `Scenariusz ${scenarioId} został uruchomiony`
      };
    }
  },
  {
    name: "toggle_scenario",
    description: "Włącza lub wyłącza scenariusz w Make",
    handler: async (params) => {
      const { scenarioId, active } = params;
      if (!scenarioId) {
        throw new Error("Brak wymaganego parametru 'scenarioId'");
      }
      if (active === undefined) {
        throw new Error("Brak wymaganego parametru 'active'");
      }
      const result = await makeApi.toggleScenario(scenarioId, active);
      return { 
        success: true,
        scenarioId: result.id,
        active: result.active,
        message: `Scenariusz ${scenarioId} został ${active ? 'aktywowany' : 'dezaktywowany'}`
      };
    }
  },
  {
    name: "get_scenario",
    description: "Pobiera szczegóły scenariusza w Make",
    handler: async (params) => {
      const { scenarioId } = params;
      if (!scenarioId) {
        throw new Error("Brak wymaganego parametru 'scenarioId'");
      }
      const scenario = await makeApi.getScenario(scenarioId);
      return { scenario };
    }
  },
  {
    name: "create_scenario",
    description: "Tworzy nowy scenariusz w Make",
    handler: async (params) => {
      const { name, folderID } = params;
      if (!name) {
        throw new Error("Brak wymaganego parametru 'name'");
      }
      const result = await makeApi.createScenario(name, folderID);
      return { 
        success: true,
        scenarioId: result.id,
        name: result.name,
        message: `Scenariusz "${name}" został utworzony`
      };
    }
  },
  {
    name: "list_apps",
    description: "Pobiera listę wszystkich dostępnych aplikacji w Make",
    handler: async () => {
      const apps = await makeApi.getApps();
      return { apps };
    }
  },
  {
    name: "get_scenario_history",
    description: "Pobiera historię uruchomień scenariusza w Make",
    handler: async (params) => {
      const { scenarioId, limit } = params;
      if (!scenarioId) {
        throw new Error("Brak wymaganego parametru 'scenarioId'");
      }
      const history = await makeApi.getScenarioHistory(scenarioId, limit);
      return { history };
    }
  }
];

// Obsługa połączeń WebSocket
wss.on('connection', (ws) => {
  console.log('Nowe połączenie WebSocket');

  // Funkcja pomocnicza do wysyłania odpowiedzi
  const sendResponse = (id, result, error) => {
    const response = {
      jsonrpc: "2.0",
      id
    };

    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }

    console.log('Wysyłanie odpowiedzi:', JSON.stringify(response));
    ws.send(JSON.stringify(response));
  };

  // Obsługa wiadomości
  ws.on('message', async (data) => {
    console.log('Otrzymano dane:', data.toString());
    let request;

    try {
      request = JSON.parse(data);
      console.log('Przetworzone żądanie:', request);
    } catch (error) {
      console.error('Błąd parsowania JSON:', error);
      sendResponse(null, null, {
        code: -32700,
        message: "Nieprawidłowe żądanie JSON"
      });
      return;
    }

    // Sprawdź czy żądanie ma prawidłowy format JSON-RPC 2.0
    if (!request.jsonrpc || request.jsonrpc !== "2.0" || !request.method) {
      sendResponse(request.id || null, null, {
        code: -32600,
        message: "Nieprawidłowe żądanie JSON-RPC"
      });
      return;
    }

    // Obsługa inicjalizacji
    if (request.method === 'initialize') {
      console.log('Obsługa initialize');
      sendResponse(request.id, {
        serverInfo: {
          name: "make-mcp-server",
          version: "1.0.0"
        },
        capabilities: {}
      });
      return;
    }

    // Obsługa wywołania narzędzia
    if (request.method === 'tools/invoke') {
      console.log('Obsługa tools/invoke:', request.params);
      
      const { name, parameters } = request.params || {};
      if (!name) {
        sendResponse(request.id, null, {
          code: -32602,
          message: "Nieprawidłowe parametry: brak nazwy narzędzia"
        });
        return;
      }

      const tool = tools.find(t => t.name === name);
      if (!tool) {
        sendResponse(request.id, null, {
          code: -32601,
          message: `Nieznane narzędzie: ${name}`
        });
        return;
      }

      try {
        const result = await tool.handler(parameters || {});
        sendResponse(request.id, result);
      } catch (error) {
        console.error(`Błąd podczas wykonywania narzędzia ${name}:`, error);
        sendResponse(request.id, null, {
          code: -32000,
          message: error.message
        });
      }
      return;
    }

    // Obsługa listy narzędzi
    if (request.method === 'tools/list') {
      console.log('Obsługa tools/list');
      const toolsList = tools.map(tool => ({
        name: tool.name,
        description: tool.description
      }));
      sendResponse(request.id, { tools: toolsList });
      return;
    }

    // Obsługa shutdown
    if (request.method === 'shutdown') {
      console.log('Obsługa shutdown');
      sendResponse(request.id, null);
      return;
    }

    // Obsługa exit
    if (request.method === 'exit') {
      console.log('Obsługa exit');
      sendResponse(request.id, null);
      ws.close();
      return;
    }

    // Nieznana metoda
    console.log('Nieznana metoda:', request.method);
    sendResponse(request.id, null, {
      code: -32601,
      message: `Nieznana metoda: ${request.method}`
    });
  });

  // Obsługa błędów
  ws.on('error', (error) => {
    console.error('Błąd WebSocket:', error);
  });

  // Obsługa zamknięcia połączenia
  ws.on('close', () => {
    console.log('Połączenie WebSocket zamknięte');
  });
});

// Obsługa żądań HTTP
app.get('/', (req, res) => {
  res.send('Make MCP Server działa poprawnie. Protokół WebSocket jest aktywny.');
});

// Uruchomienie serwera
server.listen(config.port, () => {
  console.log(`Make MCP Server działa na porcie ${config.port}`);
  console.log('Serwer obsługuje protokół MCP przez WebSocket');
});