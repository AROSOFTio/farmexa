from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

@event.listens_for(Session, "do_orm_execute")
def _add_branch_filter(execute_state):
    if execute_state.is_select and not execute_state.is_column_load and not execute_state.is_relationship_load:
        branch_ids = execute_state.session.info.get("branch_ids")
        if branch_ids is not None:
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    execute_state.statement.column_descriptions[0]["type"],
                    lambda cls: cls.branch_id.in_(branch_ids) if hasattr(cls, "branch_id") else None,
                    include_aliases=True
                )
            )
