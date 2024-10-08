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

app.post("/get_objectives", async (request, response) => {

  const {
    organization: organization,
    name: name,
    target_audience: target_audience,
    resources1: resources1,
    resources2: resources2,
    resources3: resources3,
    resources4: resources4,
    resources5: resources5,
    activities1: activities1,
    activities2: activities2,
    activities3: activities3,
    activities4: activities4,
    activities5: activities5,
    results1: results1,
    results2: results2,
    results3: results3,
    results4: results4,
    results5: results5,
  } = request.body;

  console.log(request?.body);

  //response.send(organization).status(200);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };

  const data = {
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "system",
        "content": "Você é um gerente de projetos com experiencia em redação de objetivos para projetos sociais."
      },
      {
        "role": "user",
        "content": `considere a estrutura ideal da matriz de marco lógico para projetos que solucionam problemas relacionados a questões sociais e ambientais. o marco lógico estrutura de forma lógica as seguintes informações do projeto seguindo esta ordem: 1) recursos 2) atividades 3) resultados 4) objetivos e 5) impacto 

        considerando um determinado projeto, 
        feito por uma organização de ${organization}
        cujo nome do projeto é: ${name}
        e cujo público alvo são: ${target_audience}
        
        um projeto com as seguntes informações: 
        
        os recursos usados: 
        ${resources1}; ${resources2}; ${resources3}; ${resources4}; ${resources5}
        
        as atividades a serem relizadas:
        ${activities1}; ${activities2}; ${activities3}; ${activities4}; ${activities5}.

        os resultados esperados serão:
        ${results1}; ${results2}; ${results3}; ${results4}; ${results5};
        
        cite três objetivos esperados desse projeto. cite apenas os objetivos
        
        responda em um json no seguinte formato:
        {
          "objetivos": [
            "objetivo 1",
            "objetivo 2",
            "objetivo 3"
          ]
        }
        `
      }
    ],
    temperature: 0.9,
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

app.post("/get_ai_results", async (request, response) => {

  const {
    organization: organization,
    project_name: project_name,
    target_audience: target_audience,
    resources1: resources1,
    resources2: resources2,
    resources3: resources3,
    resources4: resources4,
    resources5: resources5,
    action: action,
    object: object,
    activity_id: activity_id,
  } = request.body;

  console.log(request?.body);

  const results = await get_results(activity_id);

  //response.send(organization).status(200);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };

  const data = {
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "system",
        "content": "Você é um gerente de projetos com experiencia em redação de objetivos para projetos sociais."
      },
      {
        "role": "user",
        "content": `considere a estrutura ideal da matriz de marco lógico para projetos que solucionam problemas 
        relacionados a questões sociais e ambientais. o marco lógico estrutura de forma lógica as seguintes 
        informações do projeto seguindo esta ordem: 1) recursos 2) atividades 3) resultados 4) objetivos e 5) 
        impacto 

        considerando um determinado projeto, 
        feito por uma organização de ${organization}
        cujo nome do projeto é: ${project_name}
        e cujo público alvo são: ${target_audience}
        
        um projeto com as seguntes informações: 
        
        os recursos usados: 
        ${resources1}; ${resources2}; ${resources3}; ${resources4}; ${resources5}
                
        crei cinco resultdos esperados para a ação ${action} com o objeto ${object} e as variações de resultados com as palavras chave ${results}. cite apenas os resultados
        
        responda em um json no seguinte formato:
        {
          "resultados": [
            "resultado 1",
            "resultado 2",
            "resultado 3",
            "resultado 4",
            "resultado 5"
          ]
        }
        `
      }
    ],
    temperature: 0.9,
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

app.post("/create_teory", async (request, response) => {

  const {
    organization: organization,
    project_name: project_name,
    email: email,
    target_audience: target_audience,
    resources1: resources1,
    resources2: resources2,
    resources3: resources3,
    resources4: resources4,
    resources5: resources5,
    resources6: resources6,
    activities1: activities1,
    activities2: activities2,
    activities3: activities3,
    activities4: activities4,
    activities5: activities5,
    goals1: goals1,
    goals2: goals2,
    goals3: goals3,
    impacts1: impacts1,
    impacts2: impacts2,
    impacts3: impacts3,
  } = request.body;

  console.log(request?.body);

  //const results = await get_results(activity_id);

  //response.send(organization).status(200);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };

  const data = {
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "system",
        "content": "Você é um gerente de projetos com experiencia em redação de objetivos para projetos sociais."
      },
      {
        "role": "user",
        "content": `considere a estrutura ideal da matriz de marco lógico para projetos que solucionam problemas 
        relacionados a questões sociais e ambientais, escreva uma teoria da mudança a partir do seguinte texto:

        A ${organization}  por meio do ${project_name}  busca impacto sugerido pela IA com base nos inputs anteriores para
        ${target_audience}. O projeto precisa de ${resources1}, ${resources2}, ${resources3}, ${resources4}, ${resources5}, 
        ${resources6}. Com estes recursos, espera-se que ${organization}  realize ações de ${activities1}, ${activities2}, ${activities3}, 
        ${activities4}, ${activities5}  para entregar o resultado do projeto que é ${impacts1}, ${impacts2}, ${impacts3} com 
        base em cada ação, alcançando assim o objetivo de ${goals1}, ${goals2}, ${goals3} sugerido pela IA com base nos 
        inputs anteriores.

        responda em um json no seguinte formato sendo que o tamanho do final_text tem que ser entre 500 e 520 caracteres:
        {
          "theory": [
            "final_text"
          ]
        }
        `
      }
    ],
    temperature: 0.9,
    max_tokens: 520,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  axios.post('https://api.openai.com/v1/chat/completions', data, {headers})
  .then(apiResponse => {
    console.log(apiResponse.data);
    const contentObject = JSON.parse(apiResponse.data.choices[0].message.content);
    if (contentObject && contentObject.theory) {
      const theoryValue = contentObject.theory[0];
      sendEmail(project_name, theoryValue, email);
      console.log(theoryValue);
    } else {
      console.log("Theory not found in the content");
    }

    response.send(apiResponse.data.choices[0].message.content);

  })
  .catch(error => {
    console.error(error);
  });

  const result = await insertProspect(email, organization, project_name, JSON.stringify(request.body));

});

async function insertProspect(str_email, str_empresa, str_projeto, txt_dados_projeto) {
  try {
    const sql =
      "INSERT INTO prospects(str_email, str_empresa, str_projeto, txt_dados_projeto) VALUES(?,?,?,?)";
    const params = [str_email, str_empresa, str_projeto, txt_dados_projeto];
    
    const [rows, fields] = await promisePool.execute(sql, params);
    
    return rows;
  } catch (err) {
    console.error("Error executing query", err);
    return null;
  }
}


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

app.listen(PORT, (error) => {
  if (!error)
    console.log(
      "Server is Successfully Running, and App is listening on port " + PORT
    );
  else console.log("Error occurred, server can't start", error);
});
