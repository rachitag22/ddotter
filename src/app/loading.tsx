export default function Loading() {
  return (
    <div className="map-loading">
      <div className="loading-state map-loading-state" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>Loading map...</span>
      </div>
    </div>
  );
}
