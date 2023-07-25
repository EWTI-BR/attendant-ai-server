const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql2');

dotenv.config();

const connection = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.DB_USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE
});

const app = express();
const PORT = 3000;

app.get('/', (req, res)=>{
	res.status(200);
	res.send("Welcome to root URL of Server");
});

app.get('/get_resourses', (request, response) => {
  
  const sql =
    'SELECT id, recurso, false as checked FROM recursos;';

  connection.query(sql, (error, results) => {
    // If there is an issue with the query, output the error
    if (error) throw error;
    // If the account exists
    response.send(results);
  });
});

app.get('/get_activities', (request, response) => {

  const sql =
    'SELECT id, atividade FROM atividades;';

  connection.query(sql, (error, results) => {
    // If there is an issue with the query, output the error
    if (error) throw error;
    // If the account exists
    response.send(results);
  });
});

app.get('/get_objects', (request, response) => {
  
  if (!request.query.activity) {
    response.status(400).send('activity not found');
    return;
  }

  const activity = request.query.activity;

  const sql =
    'SELECT objetos.id, objeto FROM objetos INNER JOIN atividade_objeto ON objetos.id = atividade_objeto.id_objeto WHERE atividade_objeto.id_atividade = ?;';

  connection.query(sql, [activity], (error, results) => {
    // If there is an issue with the query, output the error
    if (error) throw error;
    // If the account exists
    response.send(results);
  });
});

app.get('/get_results', (request, response) => {
  
  if (!request.query.activity) {
    response.status(400).send('activity not found');
    return;
  }

  const activity = request.query.activity;

  const sql =
    'SELECT resultados.id, resultado FROM resultados INNER JOIN atividade_resultado ON resultados.id = atividade_resultado.id_resultado WHERE atividade_resultado.id_atividade = ?;';

  connection.query(sql, [activity], (error, results) => {
    // If there is an issue with the query, output the error
    if (error) throw error;
    // If the account exists
    response.send(results);
  });
});

app.listen(PORT, (error) =>{
	if(!error)
		console.log("Server is Successfully Running, and App is listening on port "+ PORT)
	else
		console.log("Error occurred, server can't start", error);
	}
);
