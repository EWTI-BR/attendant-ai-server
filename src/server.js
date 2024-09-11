const express = require("express");
const bodyParser = require('body-parser');
const dotenv = require("dotenv");
const mysql = require("mysql2");
const axios = require("axios");
const cors = require('cors');
const { Configuration, OpenAIApi } = require("openai");
const QRCode = require('qrcode');
const sgMail = require('@sendgrid/mail');

dotenv.config();

const fs = require('fs');
const { request } = require("http");

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.HOST,
  user: process.env.DB_USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});
const promisePool = pool.promise();
var corsOptions = {
  origin: 'http://www.narrai.com.br',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const PORT = 3001;
const knowledge_path = process.env.KNOWLEDGE_PATH;
const orders_path = process.env.ORDERS_PATH;

app.get("/", (req, res) => {
  res.status(200);
  res.send("Welcome to root URL of Server");
});

app.get("/get_resourses", async (request, response) => {
  try {
    const data = await get_resourses();
    response.send(data);
  } catch (err) {
    console.error(err);
    response.status(500).send("Internal server error");
  }
});

async function get_resourses() {
  try {
    const sql = "SELECT id, recurso, false as checked FROM recursos";
    const [rows, fields] = await promisePool.execute(sql);
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}

app.get("/get_activities", async (request, response) => {
  try {
    const data = await get_activities();
    response.send(data);
  } catch (err) {
    console.error(err);
    response.status(500).send("Internal server error");
  }
});

async function get_activities() {
  try {
    const sql = "SELECT id, atividade FROM atividades";
    const [rows, fields] = await promisePool.execute(sql);
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}

app.get("/get_objects", async (request, response) => {
  if (!request.query.activity) {
    response.status(400).send("activity not found");
    return;
  }

  const activity = request.query.activity;
  try {
    const data = await get_objects(activity);
    response.send(data);
  } catch (err) {
    console.error(err);
    response.status(500).send("Internal server error");
  }
});

async function get_objects(activity) {
  try {
    const sql =
      "SELECT objetos.id, objeto FROM objetos INNER JOIN atividade_objeto ON objetos.id = atividade_objeto.id_objeto WHERE atividade_objeto.id_atividade = ?";
    const params = [activity];
    const [rows, fields] = await promisePool.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}

app.get("/get_results", async (request, response) => {
  if (!request.query.activity) {
    response.status(400).send("activity not found");
    return;
  }
  const activity = request.query.activity;
  try {
    const data = await get_results(activity);
    response.send(data);
  } catch (err) {
    console.error(err);
    response.status(500).send("Internal server error");
  }
});

async function get_results(activity) {
  try {
    const sql =
      "SELECT resultados.id, resultado FROM resultados INNER JOIN atividade_resultado ON resultados.id = atividade_resultado.id_resultado WHERE atividade_resultado.id_atividade = ?";
    const params = [activity];
    console.log(sql);
    const [rows, fields] = await promisePool.execute(sql, params);
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}

async function runAiCommands(query) {
  try {
    const sql = query;
    //const params = [activity];
    const [rows, fields] = await promisePool.execute(sql);
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}

/**
 * Generate a QR code in SVG format.
 * 
 * @param {string} text - The text/data to encode in the QR code.
 * @returns {Promise<string>} The SVG string representation of the QR code.
 */
async function generateSVGQRCode(text) {
  try {
      let svgString = await QRCode.toString(text, {
          type: 'svg'
      });
      return svgString;
  } catch (err) {
      throw new Error('Failed to generate QR code: ' + err.message);
  }
}

app.get('/get_qrcode/:text', async (req, res) => {
    try {
        const URL = process.env.CLIENT_URL;
        const text = req.params.text;
        const svg = await generateSVGQRCode(URL + "/trilhas/credito?" + text);
        res.header('Content-Type', 'image/svg+xml');
        res.send(svg);
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate QR code.' });
    }
});

app.post("/create", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await openai.createImage({
      prompt,
      n: 4,
      size: "1024x1024",
    });
    res.send(response.data.data[0].url);
  } catch (err) {
    res.send(err.message);
  }
});

app.post("/adjust_frase", async (request, response) => {
  const openai = new OpenAIApi(configuration);

  const prompt =
  'Translate the following English text to French: "{\\"text\\": \\"Hello, world!\\"}"';
  
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        "role": "assistant",
        "content": "You are a helpful assistant"
      },
      {
        "role": "user",
        "content": "Who won the world series in 2020?"
      }
    ],
    temperature: 1,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  response.send(completion);
});

app.post("/load_data_model", async (request, response) => {
  const {
    connection: connection,
    database: database,
    tables: tables,
  } = request.body;

  try {
    const data = await runAiCommands(query);
    response.send(data);
  } catch (err) {
    console.error(err);
    response.status(500).send("Internal server error");
  }

})

// load data file
async function loadDataFromFile(filePath) {
  try {
    const data = await fs.readFileSync(filePath, "utf8");
    return data;
  } catch (err) {
    console.error("Error reading the file", err);
    throw err; // or handle error as you see fit
  }
}

async function getDayOfWeekInPortuguese() {
  const today = new Date();
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(today);
}

async function getTodayDateWithWeekday() {
  const today = new Date();

  const dateFormat = new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
  });

  const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { 
      weekday: 'long' 
  });

  return `${weekdayFormat.format(today)}, ${dateFormat.format(today)}`;
}

async function queryAI(request) {

  const {
    knowledge_base: knowledge_base,
    question: question,
    pedido: pedido,
  } = request.body;

  console.log(request?.body);
  console.log(request?.knowledge_base);
  console.log(question);
  console.log(getTodayDateWithWeekday());
  const dateComplete = await getTodayDateWithWeekday();

  let Knowledge_base_data;
  if(!knowledge_base) {
    Knowledge_base_data = await loadDataFromFile("data/" + knowledge_path + "/main.txt");
  } else {
    Knowledge_base_data = await loadDataFromFile("data/" + knowledge_path + "/" + knowledge_base + ".txt");
  }
  console.log(Knowledge_base_data);

  //response.send(organization).status(200);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };
  
  const data = {
    "model": "gpt-4o-2024-05-13",  // Corrected model name
    "messages": [
      {
        "role": "system",
        "content": "Você é um serviço de atendimento ao público e responde baseado nas bases de dados que sao carregadas. Sempre que for sugerir que entre em contato você deve sugerir o email e telefone de contato."
      },
      {
        "role": "user",
        "content": `Sabendo que hoje é ${dateComplete} e baseado na seguinte base de conhecimento: ${Knowledge_base_data}
  
        responda a seguinte pergunta: ${question}
  
        se a sugestão for para trocar a base de conhecimento, utilize apenas as seguintes bases de conhecimento: vendas, entregas, tecnologia, marketing. Responda no seguinte formato: #knowledge_base|<nome da base de conhecimento>|

        se a pergunta for sobre um pedido no formato de 8 ou mais digitos, responda no seguinte formato: #numero-do-pedido|<numero do pedido>|

        ${pedido}

        Não responda nada que não tenha relação com os dados fornecidos aqui.
        `
      }
    ],
    temperature: 0.9,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };
  
  try {
    const apiResponse = await axios.post('https://api.openai.com/v1/chat/completions', data, { headers });
    const messageContent = apiResponse.data.choices[0]?.message?.content || "";
    
    console.log(messageContent);

    if (messageContent.startsWith("#")) {
      const operationType = messageContent.split("|")[0];
      const newKnowledgeBase = messageContent.split("|")[1];
      console.log("Operation type: ", operationType);

      if(operationType === "#knowledge_base") {
        request.body.knowledge_base = newKnowledgeBase;
        console.log("Switching knowledge base to: ", request.body.knowledge_base);
      } else if(operationType === "#numero-do-pedido") {
        request.body.question += await loadDataFromFile("data/" + orders_path + "/" + request.body.question);
        console.log("Pedido: ", newKnowledgeBase);
        console.log("Pedido: ", request.body.question);
        return newKnowledgeBase;
      }
      // Recursively call queryAI with the updated knowledge_base 
      return await queryAI(request); 
    } else {
      return messageContent;
    }
  } catch (error) {
    console.error('API error:', error.response ? error.response.data : error.message);
    throw error;
  }

}

app.post("/attendant", async (request, response) => {
  try {
    let answer = await queryAI(request);
    response.send(answer);
  } catch (error) {
    response.status(500).send("An error occurred while processing your request.");
  }
});



function sendEmail(name_project, final_text, recipientEmail) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);  // Set your API key here or use an environment variable

  const msg = {
    to: recipientEmail,      // Recipient email
    from: 'notte@ewti.com.br',   // Your SendGrid verified sender email
    templateId: 'd-4fb1ab8f1d8945e2bc5ed2abdac41ae2',  // Replace with your SendGrid Template ID
    dynamic_template_data: {
      project_name: name_project,
      final_text: final_text
    },
  };

  sgMail
    .send(msg)
    .then(() => {
      console.log('Email sent successfully!');
    })
    .catch(error => {
      console.error('Error sending email:', error);
    });
}

async function load_table_desc(table) {
  try {
    // Ensure that table name does not contain any malicious or unexpected characters
    if (!table.match(/^[a-zA-Z0-9_]+$/)) {
      throw new Error("Invalid table name");
    }
    
    const sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "` + table + `"`;
    console.log(sql);
    const [rows, fields] = await promisePool.execute(sql);
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}
async function fetchURL(url) {
  try {
      const response = await axios.get(url);
      return response.data;
  } catch (error) {
      throw error;
  }
}

async function load_webpage(url) {
  try {
    // Ensure that table name does not contain any malicious or unexpected characters
    if (!table.match(/^[a-zA-Z0-9_]+$/)) {
      throw new Error("Invalid table name");
    }
    
    const sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "` + table + `"`;
    console.log(sql);
    const [rows, fields] = await promisePool.execute(sql);
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}

app.post("/change_pass", async (request, response) => {

  console.log(request?.body);

  const desc_table = await load_table_desc('admin');
  console.log(desc_table);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };

  const data = {
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "system",
        "content": "você é um analista de sistemas experiente com MySQL"
      },
      {
        "role": "user",
        "content": `sendo os campos de uma tabela de usuários ${desc_table}, crie uma query de MySQL 8 para atualizar a senha do usuário usando o e-mail notte@ewti.com.br e a senha !Q2w3e4r sendo que a senha tem a encriptação nativa de MD5 do banco de dados.

        responda apenas a query que preciso rodar no banco de dados, sem nenhum texto antes ou depois, em apenas uma linha.
        `
      }
    ],
    temperature: 1.3,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  axios.post('https://api.openai.com/v1/chat/completions', data, {headers})
  .then(apiResponse => {
    console.log(apiResponse.data);
    response.send(apiResponse.data.choices[0].message.content);
  })
  .catch(error => {
    console.error(error);
  });
});

app.listen(PORT, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running, and App is listening on port " + PORT
    );
  else console.log("Error occurred, server can't start", error);
});
