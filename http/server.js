const fastify = require('fastify')({ logger: true });
const { Pool } = require('pg');

const PORT = process.env.PORT || 3002;

const pool = new Pool({
  host: 'localhost',
  user: 'admin',
  password: '123',
  database: 'rinha',
  port: 5432,
});

fastify.post('/clientes/:id/transacoes', async function (request, reply) {
  const { id } = request.params;
  const { valor, tipo, descricao } = request.body

  if (!Number.isInteger(Number(id))) {
    return reply.status(400).send({ error: 'O "id" do cliente deve ser um inteiro!' });
  }

  if (!valor || !tipo || !descricao) {
    return reply.status(400).send({ error: 'Requisição inválida, passe todos os campos necessários!' });
  }

  if (!(Number.isInteger(Number(valor)) && Number(valor) > 0)) {
    return reply.status(400).send({ error: 'O campo "valor" deve ser um inteiro positivo!' });
  }

  if (tipo != "c" && tipo != "d") {
    return reply.status(400).send({ error: 'O campo "tipo" deve ser representado pelas letras "c" ou "d"!' });
  }

  if (typeof descricao === 'string') {
    if (descricao.length > 10) {
      return reply.status(400).send({ error: 'O campo "descricao" deve ter no máximo 10 caracteres!' });
    }
  } else {
    return reply.status(400).send({ error: 'O campo "descricao" deve ser uma string' });
  }

  try {
    const { rows } = await pool.query('SELECT Cliente.limite, Saldo.valor as saldo FROM clientes Cliente INNER JOIN saldos Saldo ON Cliente.id = Saldo.cliente_id WHERE Cliente.id = $1 LIMIT 1', [id]);

    if (rows.length === 0) {
      return reply.status(404).send({ error: "Cliente não encontrado!" })
    }
  
    const { limite, saldo } = rows[0]

    let novoSaldo = 0

    if (tipo === "d") {
      novoSaldo = saldo - valor
    } else if (tipo === "c") {
      novoSaldo = saldo + valor
    }

    if (tipo === "d" && ((novoSaldo * -1) < limite)) {
      reply.status(422).send({ error: "O saldo ficará menor que o limite do cliente!" })
      return
    }

    await pool.query(
      'INSERT INTO transacoes (cliente_id, valor, tipo, descricao) VALUES ($1, $2, $3, $4)',
      [id, valor, tipo, descricao]
    );

    await pool.query(
      'UPDATE saldos SET valor = $1 WHERE cliente_id = $2',
      [novoSaldo, id]
    );

    reply.send({ limite, novoSaldo })
  } catch (error) {
    console.log('error', error)
    return reply.status(500).send({ error })
  }
});

fastify.get('/clientes/:id/extrato', async function (request, reply) {
  const { id } = request.params

  if (!id) {
    reply.status(404)
    return
  }

  const data = {
    "saldo": {
      "total": -9098,
      "data_extrato": "2024-01-17T02:34:41.217753Z",
      "limite": 100000
    },
    "ultimas_transacoes": [
      {
        "valor": 10,
        "tipo": "c",
        "descricao": "descricao",
        "realizada_em": "2024-01-17T02:34:38.543030Z"
      },
      {
        "valor": 90000,
        "tipo": "d",
        "descricao": "descricao",
        "realizada_em": "2024-01-17T02:34:38.543030Z"
      }
    ]
  }

  reply.send(data)
});

fastify.listen({ port: PORT }, '0.0.0.0', function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  console.log(`HTTP server is running on http://localhost:${PORT} 🔥`);
})