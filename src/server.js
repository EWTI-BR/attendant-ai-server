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

const pool_TJ = mysql.createPool({
  connectionLimit: 10,
  host: process.env.HOST_TJ,
  user: process.env.DB_USER_TJ,
  password: process.env.PASSWORD_TJ,
  database: process.env.DATABASE_TJ,
});
const promisePool_TJ = pool_TJ.promise();

var corsOptions = {
  origin: 'https://attendant-ai.netlify.app/',
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
const PORT = 3002;
const knowledge_path = process.env.KNOWLEDGE_PATH;
const orders_path = process.env.ORDERS_PATH;

app.get("/", (req, res) => {
  res.status(200);
  res.send("Welcome to root URL of Server Attendant-AI");
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
    data_folder: data_folder,
  } = request.body;

  console.log(request?.body);
  console.log(request?.knowledge_base);
  console.log(question);
  console.log(data_folder);
  console.log(getTodayDateWithWeekday());
  const dateComplete = await getTodayDateWithWeekday();
  const hour = new Date().toLocaleTimeString();

  console.log(hour);
  let Knowledge_base_data;
  if(!knowledge_base) {
  Knowledge_base_data = await loadDataFromFile("./data/" + data_folder + "/" + "/main.txt");
  } else {
  Knowledge_base_data = await loadDataFromFile("./data/" + data_folder + "/" + "/" + knowledge_base + ".txt");
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
        "content": `Adicione na sua resposta sempre a data e hora nesse formato: [${dateComplete} ${hour}] - e o resto do texto.
        
        Sabendo que hoje é ${dateComplete} às ${hour} e baseado na seguinte base de conhecimento: ${Knowledge_base_data}
  
        responda a seguinte pergunta: ${question}
  
        se a sugestão for para trocar a base de conhecimento, utilize apenas as seguintes bases de conhecimento: vendas, entregas, tecnologia, marketing, produtos. Responda no seguinte formato: #knowledge_base|<nome da base de conhecimento>|

        se a pergunta for sobre um pedido no formato de 8 ou mais digitos, responda no seguinte formato: #numero-do-pedido|<numero do pedido>|

        ${pedido}

        Não responda nada que não tenha relação com os dados fornecidos aqui.

        Se alguem pedir para falar com um atendente, o horario for dentro do expediente, devolva um link de whatsapp com o telefone 11 983353833.

        sempre responda usando HTML, se tiver um numero adicione sempre links clicaveis.
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

// Corrected queryAITJ function
async function queryAITJ(userData) {
  const { nome, sobrenome, email, telefone, cidade, estado, cursos } = userData[0];

  console.log('User Data:', { nome, sobrenome, email, telefone, cidade, estado, cursos });
  const dateComplete = await getTodayDateWithWeekday();

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };

  const data = {
    "model": "gpt-4o-2024-05-13", // Corrected model name
    "messages": [
      {
        "role": "system",
        "content": "Você é uma especialista educacional e deve analisar os dados do usuario e sugerir algumas ações para melhorar o seu desenvolvimento educacional com base nas bases de dados carregadas. Você está falando com um usuário simples, utilize palavras faceis e acessívei."
      },
      {
        "role": "user",
        "content": `O perfil do usuário é: ${nome} ${sobrenome}, email: ${email}, telefone: ${telefone}, cidade: ${cidade}, estado: ${estado}.
        Analise os seguintes cursos: ${cursos}.
        
        Seja bem suscinta e direta e sugira uma ação imediata e uma ação para fazer na sequencia dentre todas as possíveis para melhorar o desenvolvimento educacional do usuário. 
        
        Caso não tenha opções sugira um dos nossos 12 diferentes cursos: MARKETPLACES para pequenos negócios: VALE A PENA?,6 plataformas de venda online para pequenos negócios,Facebook para negócios,Instagram para negócios,WhatsApp para negócios,Criando um cardápio digital,TikTok para negócios,Como escolher a MELHOR REDE SOCIAL para minha empresa?,Como CRIAR um POST no CANVA [5 PASSOS SIMPLES],Organize SUAS METAS: Como planejar a GESTÃO FINANCEIRA do seu negócio,Como SEPARAR O DINHEIRO da EMPRESA e da vida PESSOAL?,Como PARAR de vender FIADO de uma vez por todas,Aprenda a criar uma RESERVA DE EMERGÊNCIA para o seu negócio,Arrasando! 5 dicas sobre como economizar dinheiro,Fluxo de caixa e livro caixa: gerenciando as finanças de sua empresa [PLANILHA GRATUITA],Como reduzir custos,Precificação: Como CALCULAR O PREÇO DO MEU PRODUTO OU SERVIÇO,Desvendando o crédito + Aprenda a fazer o plano de negócios (2 em 1),5 dicas para DIGITALIZAR sua EMPRESA,MARKETPLACE ou LOJA VIRTUAL: qual é a melhor opção para o seu negócio?,Como cuidar das FINANÇAS do seu negócio,5 vantagens dos BANCOS DIGITAIS para EMPREENDEDORES,5 DICAS para DEFINIR O CAPITAL DE GIRO do seu negócio,Direitos e deveres do MEI ,Como ATRAIR MAIS CLIENTES usando as REDES SOCIAIS?,Como criar LINHA EDITORIAL para Instagram,Perca o medo de gravar vídeo!, Como tirar BOAS FOTOS de produto com CELULAR,Como EDITAR FOTOS pelo CELULAR  [Apps GRATUITOS],VALOR POR INBOX: 4 Motivos para NÃO USAR a estratégia,Como organizar as ENTREGAS de produtos vendidos pela INTERNET,USANDO o ChatGPT no seu negócio em menos de 6 Minutos!,Como LIBERAR ESPAÇO no CELULAR FÁCIL! [APP GRATUITO],GESTÃO DO TEMPO: 3 aplicativos para GERENCIAR SUAS TAREFAS,Dicas de como se livrar das DÍVIDAS,Como COBRAR a DÍVIDA do cliente #SHORTS,Golpes financeiros: como identificar e evitar armadilhas,5 ERROS que fazem você PERDER ENGAJAMENTO no seu NEGÓCIO,4 Ps do Marketing: o que é, exemplos e como aplicar em pequenos negócios,Como usar a LINGUAGEM POSITIVA para FIDELIZAR seus clientes!,Gatilhos mentais: o que são e como usar para vender mais!,Rainhas do Empreendedorismo: Quebrando as Barreiras!,Usando a TECNOLOGIA E OS SERVIÇOS DE PAGAMENTO para impulsionar o seu negócio,Superpoderes da Tecnologia,Empreender Modo On,Curso de Marketing Digital para empreendedores,Controles administrativos e gestão: com planilhas prontas no excel,Formalização MEI Passo a Passo,Artesanato e Costura: esse é meu negócio!,Porque você e todo mundo pode empreender,Educação Financeira para Mulheres Empreendedoras - Módulo 1,Educação Financeira para Mulheres Empreendedoras - Módulo 2,Como arrasar nas vendas online – parceria com o Mercado Livre,Como definir o preço ideal e vender pela internet seus produtos de moda,Como cuidar das finanças do seu negócio,Como inovar e ter uma marca de moda sustentável,Como ser um(a) empreendedor(a) mais eficiente,Conheça as melhores estratégias para sua marca de moda ter sucesso na internet,Educação Financeira para Mulheres Empreendedoras - Módulo 2,Empreendedorismo Inclusivo,Canais de venda online e marketing,Dicas para vender mais na internet,Ferramentas financeiras,Organização financeira,Vendas e comunicação para o seu negócio,Aprenda a fazer o PLANO DE NEGÓCIOS,Curso para MEI de gestão de negócios,Negócios Digitais para Iniciantes,Marketing e Finanças para Ambulantes,Como ser Influencer do seu negócio!
        
        Use dados educacionais junto com os dados fornecidos aqui para fornecer uma indicação clara e direta para o empreendedor.

        Responda para o usuário na primeira pessoa. Não ultrapasse 420 caracteres.

        Responda em format HTML.
        `
      }
    ],
    temperature: 0.9,
    max_tokens: 220,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  try {
    const apiResponse = await axios.post('https://api.openai.com/v1/chat/completions', data, { headers });
    const messageContent = apiResponse.data.choices[0]?.message?.content || "";
    console.log('API Response:', messageContent);

    if (messageContent.startsWith("#")) {
      const operationType = messageContent.split("|")[0];
      const newKnowledgeBase = messageContent.split("|")[1];
      console.log("Operation type:", operationType);

      if (operationType === "#knowledge_base") {
        console.log("Switching knowledge base to:", newKnowledgeBase);
        return await queryAITJ(userData, question, newKnowledgeBase, data_folder, orders_path); // Re-run with the new knowledge base
      } else if (operationType === "#numero-do-pedido") {
        const additionalData = await loadDataFromFile(`./data/${orders_path}/${newKnowledgeBase}`);
        return `Pedido: ${newKnowledgeBase}\n${additionalData}`;
      }
    } else {
      return messageContent;
    }
  } catch (error) {
    console.error('API error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Corrected POST handler
app.post("/login_tamojunto", async (request, response) => {
  const { userLogin } = request.body;
  console.log('Request body:', request?.body);

  try {
    const userData = await login_tamojunto(userLogin);
    if (userData && userData.length > 0) {
      const answer = await queryAITJ(userData);
      response.send(answer);
    } else {
      response.status(404).send("No user found with the provided login.");
    }
  } catch (error) {
    console.error("Error:", error);
    response.status(500).send("An error occurred while processing your request.");
  }
});


async function login_tamojunto(userLogin) {
  try {
    const sql = `
                SELECT 
                  e.str_nome AS nome,
                  e.str_sobrenome AS sobrenome,
                  e.str_email AS email,
                  e.str_telefone AS telefone,
                  e.str_cidade AS cidade,
                  e.str_estado AS estado,
                  CONCAT('[', 
                    GROUP_CONCAT(
                      CONCAT(
                        '{"curso_titulo":"', c.titulo, '",',
                        '"curso_descricao":"', c.descricao, '",',
                        '"curso_status":"', uc.str_status, '",',
                        '"data_inscricao":"', IFNULL(uc.dt_inscricao, 'null'), '",',
                        '"data_conclusao":"', IFNULL(uc.dt_conclusao, 'null'), '",',
                        '"progresso":"', IFNULL(p.int_progressao, 0), '"}'
                      ) SEPARATOR ','
                    ), 
                  ']') AS cursos
                FROM 
                  tab_empreendedor e
                LEFT JOIN 
                  tab_usuario_curso uc ON e.int_empreendedor_id_pk = uc.int_empreendedor_id_fk
                LEFT JOIN 
                  tab_cursos c ON uc.int_curso_id_fk = c.int_curso_id_fk
                LEFT JOIN 
                  tab_usuario_curso_progressao p ON e.int_empreendedor_id_pk = p.int_empreendedor_id_fk
                  AND uc.int_curso_id_fk = p.int_curso_id_fk
                WHERE 
                  e.str_email = ?
                GROUP BY 
                  e.int_empreendedor_id_pk
                LIMIT 1;
              `;
    const params = [userLogin];
    console.log(sql);
    const [rows, field] = await promisePool_TJ.execute(sql, params);
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
