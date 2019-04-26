import { WebSocketLink } from "apollo-link-ws";
import ApolloClient from "apollo-client/ApolloClient";
import { InMemoryCache } from "apollo-cache-inmemory";
import { gql } from "apollo-boost";
import * as ws from "ws";
import node_fetch from "node-fetch";
import { SubscriptionClient } from "subscriptions-transport-ws";
import { createDfuseClient } from "@dfuse/client";

(global as any).WebSocket = ws;
(global as any).fetch = node_fetch;

const API_KEY = process.argv[2];
if (API_KEY === undefined) {
  console.log("Missing api key program argument")
  process.abort()
}

const dfuseClient = createDfuseClient({apiKey: API_KEY, network: "kylin"});

dfuseClient.getTokenInfo().then(tokenInfo => {

  const client = new SubscriptionClient("wss://kylin.eos.dfuse.io/graphql", {
    lazy: true,
    reconnect: true,
    connectionParams: () => {
      return {Authorization: `Bearer ${tokenInfo.token}`};
    },
    connectionCallback: (error, result) => {
      console.log("Connection call back:", error, result)
    }
  }, ws);

  const wsLink = new WebSocketLink(client);
  const apolloClient = new ApolloClient({link: wsLink, cache: new InMemoryCache()});

  apolloClient.query({
    query: gql`query {
		            searchTransactionsForward(query: "status:executed", limit:1) {
			            results{ trace { matchingActions {receiver account name json }}}}}`
  }).then(result => console.log("SearchTransactionsForward:", result))
    .catch(err => console.log("error:", err));

  apolloClient.subscribe({
    query: gql` subscription {
		              searchTransactionsForward(query: "status:executed") {
			            trace { matchingActions {receiver account name json }}}}`
  }).subscribe({
    start: subscription => console.log("started", subscription),
    next: value => {
      const trace = value.data.searchTransactionsForward.trace;
      trace.matchingActions.forEach(function (a) {
        console.log("action", a.receiver, a.account, a.name)
      });

    },
    error: errorValue => console.log("error:", errorValue),
    complete: () => console.log("completed")
  });

}).catch(reason => console.log("error:", reason));