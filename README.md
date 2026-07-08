# Mejoras a implementar en la API externa
- Poder hacer sync incremental: --> (evita traer todas las listas e items)
  ejemplo GET /todolists?since=2026-01-01

- Agregar un endpoint para poder crear un item en un todolist existente
  ejemplo POST /todolists/{todolistsid}/todo-item/

# Problemas a resolver
Idempotencia. Si una sync falla a la mitad y la reintentás, no debe duplicar entidades.

# nextjs-interview / TodoApi

[![Open in Coder](https://dev.crunchloop.io/open-in-coder.svg)](https://dev.crunchloop.io/templates/fly-containers/workspace?param.Git%20Repository=git@github.com:crunchloop/nextjs-interview.git)

This is a simple Todo List API built in Nest JS and Typescript. This project is currently being used for Javascript/Typescript full-stack candidates.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

Check integration tests at: (https://github.com/crunchloop/interview-tests)

## Contact

- Martín Fernández (mfernandez@crunchloop.io)

## About Crunchloop

![crunchloop](https://s3.amazonaws.com/crunchloop.io/logo-blue.png)

We strongly believe in giving back :rocket:. Let's work together [`Get in touch`](https://crunchloop.io/#contact).
