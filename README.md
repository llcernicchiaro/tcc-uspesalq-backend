# 🏃‍♂️ Grupos de Corrida - API REST

Esta é a documentação da API para o sistema de gerenciamento de grupos de corrida.

## 🔐 Autenticação

Todos os endpoints requerem autenticação via **Amazon Cognito Authorizer**.
O token JWT deve ser enviado no header:

```http
Authorization: Bearer <token>
```

---

## 👤 Usuários

### Listar todos os usuários

**GET** `/users`

- Retorna uma lista de todos os usuários cadastrados.

---

## 🏃‍♂️ Grupos

### Criar grupo

**POST** `/groups`

- Cria um novo grupo de corrida.

### Listar todos os grupos

**GET** `/groups`

- Retorna todos os grupos públicos e abertos.

### Listar meus grupos

**GET** `/groups/mine`

- Retorna os grupos em que o usuário autenticado participa ou administra.

### Buscar grupo por ID

**GET** `/groups/{id}`

- Retorna os detalhes de um grupo específico.

### Atualizar grupo

**PATCH** `/groups/{id}`

- Atualiza os dados de um grupo existente (somente administradores).

### Deletar grupo

**DELETE** `/groups/{id}`

- Remove um grupo (somente administradores).

### Obter URL de upload de imagem

**POST** `/groups/upload-url`

- Gera uma URL temporária para upload de imagem no S3.

---

## 👥 Membros e Participações

### Listar membros e solicitações

**GET** `/groups/{groupId}/memberships`

- Retorna duas listas: membros aprovados e solicitações pendentes (caso o grupo seja fechado).

### Solicitar entrada em grupo

**POST** `/groups/{groupId}/memberships`

- Usuário solicita participação em um grupo.

### Sair do grupo

**POST** `/groups/{groupId}/memberships/leave`

- Remove o usuário logado do grupo.

### Aprovar ou rejeitar solicitação

**PATCH** `/groups/{groupId}/memberships/{userId}/status`

- Atualiza o status da solicitação de um usuário para "approved" ou "rejected".

**Body**:

```json
{
  "status": "approved" // ou "rejected"
}
```

---

## ℹ️ Observações

- Os dados dos usuários sempre incluem: `id`, `name`, `email`, `picture`, `createdAt`, `updatedAt`.
- Todas as requisições e respostas utilizam o formato JSON.

---

Em caso de dúvidas, consulte os schemas de validação ou entre em contato com a equipe técnica.

```

### Local development

The easiest way to develop and test your function is to use the `dev` command:

```

serverless dev

```

This will start a local emulator of AWS Lambda and tunnel your requests to and from AWS Lambda, allowing you to interact with your function as if it were running in the cloud.

Now you can invoke the function as before, but this time the function will be executed locally. Now you can develop your function locally, invoke it, and see the results immediately without having to re-deploy.

When you are done developing, don't forget to run `serverless deploy` to deploy the function to the cloud.
```
