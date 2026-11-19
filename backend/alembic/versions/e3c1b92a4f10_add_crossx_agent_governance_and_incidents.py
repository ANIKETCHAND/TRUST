"""add crossx agent governance and incidents

Revision ID: e3c1b92a4f10
Revises: 5676b4452e39
Create Date: 2026-11-19 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3c1b92a4f10'
down_revision: Union[str, None] = '5676b4452e39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safely alter agents table using batch_alter_table for SQLite & Postgres compatibility
    with op.batch_alter_table('agents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('agent_type', sa.String(length=64), server_default='custom_python', nullable=False))
        batch_op.add_column(sa.Column('owner', sa.String(length=128), server_default='security_admin', nullable=True))
        batch_op.add_column(sa.Column('environment', sa.String(length=64), server_default='production', nullable=False))
        batch_op.add_column(sa.Column('risk_classification', sa.String(length=32), server_default='LOW', nullable=False))
        batch_op.add_column(sa.Column('security_score', sa.Float(), server_default='100.0', nullable=False))
        batch_op.add_column(sa.Column('agent_version', sa.String(length=32), server_default='1.0.0', nullable=False))
        batch_op.add_column(sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=True))

        batch_op.create_index(batch_op.f('ix_agents_agent_type'), ['agent_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_agents_environment'), ['environment'], unique=False)
        batch_op.create_index(batch_op.f('ix_agents_risk_classification'), ['risk_classification'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('agents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_agents_risk_classification'))
        batch_op.drop_index(batch_op.f('ix_agents_environment'))
        batch_op.drop_index(batch_op.f('ix_agents_agent_type'))

        batch_op.drop_column('last_activity_at')
        batch_op.drop_column('agent_version')
        batch_op.drop_column('security_score')
        batch_op.drop_column('risk_classification')
        batch_op.drop_column('environment')
        batch_op.drop_column('owner')
        batch_op.drop_column('agent_type')
