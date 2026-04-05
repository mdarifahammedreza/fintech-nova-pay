import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Query for GET /accounts/:id/statement (page / limit from pagination helper). */
export class AccountStatementQueryDto extends PaginationQueryDto {}
