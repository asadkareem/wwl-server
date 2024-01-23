export class GeneralError extends Error {
  constructor(message) {
    super();
    this.message = message;
  }

  getCode() {
    if (this instanceof BadRequest) {
      return 400;
    }

    if (this instanceof NotFound) {
      return 404;
    }

    if (this instanceof Unauthorized) {
      return 403;
    }

    return 500;
  }
}

export class BadRequest extends GeneralError { }
export class NotFound extends GeneralError { }
export class Unauthorized extends GeneralError { }
