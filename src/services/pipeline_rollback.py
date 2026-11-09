# src/services/pipeline_rollback.py
class PipelineRollback:
    def capture_state(self, db):
        """Kap gjendjen para aplikimit."""
        return {
            "interventions": [i.id for i in db.query(Intervention).all()],
            "allocations": [a.id for a in db.query(ResourceAllocationRecord).all()],
            "dispatches": [d.id for d in db.query(AmbulanceDispatch).all()],
            "snapshot": datetime.utcnow(),
        }
    
    def rollback(self, db, checkpoint):
        """Kthe gjendjen pas aplikimit të dështuar."""
        # Fshij records e krijuara pas checkpoint
        db.query(Intervention).filter(Intervention.created_at > checkpoint["snapshot"]).delete()
        db.query(ResourceAllocationRecord).filter(ResourceAllocationRecord.generated_at > checkpoint["snapshot"]).delete()
        db.query(AmbulanceDispatch).filter(AmbulanceDispatch.dispatched_at > checkpoint["snapshot"]).delete()
        db.commit()