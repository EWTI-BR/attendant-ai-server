import openai

openai.api_key = "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"

completion = openai.ChatCompletion.create(
  model = "gpt-3.5-turbo",
  temperature = 0.8,
  max_tokens = 60,
  messages = [
    {"role": "system", "content": "voce é um ativista social que se preocupa com o bem estar da sociedade"},
    {"role": "user", "content": "escreva os beneficios da agua potável"},
    {"role": "assistant", "content": "a água potavel é um importante recurso natural para o desenvolvimento das criancas"},
    {"role": "user", "content": "escreva um relacionado a comida saudavel"}
  ]
)

print(completion.choices[0].message)