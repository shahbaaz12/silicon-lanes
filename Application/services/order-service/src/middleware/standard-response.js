import os from "node:os";

export function standardResponse(serviceName) {
  const server = process.env.INSTANCE_NAME ?? os.hostname();

  return (_request, response, next) => {
    response.set("x-service-name", serviceName);
    response.set("x-request-server", server);

    const sendJson = response.json.bind(response);
    response.json = (body) => {
      const isError = response.statusCode >= 400;
      return sendJson({
        ...(isError
          ? { error: { message: body?.error ?? body?.message ?? "Request failed" } }
          : { data: body }),
        servedBy: { service: serviceName, server }
      });
    };

    next();
  };
}
